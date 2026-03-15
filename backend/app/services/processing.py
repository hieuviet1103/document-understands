import hashlib
import hmac
import json
import logging
import re
import sys
from datetime import datetime, timezone
from typing import Dict, Any

import httpx
from celery import Celery
from postgrest.exceptions import APIError as PostgrestAPIError

from app.core.config import settings
from app.core.supabase import get_supabase_admin_client
from app.services.gemini import gemini_service
from app.services.output_formatter import output_formatter
from app.services.storage import storage_service

logger = logging.getLogger(__name__)


celery_app = Celery(
    "document_processing",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=1800,
    task_soft_time_limit=1500,
    broker_connection_retry_on_startup=True,
)
# Windows: prefork pool causes PermissionError/OSError with billiard; use solo pool
if sys.platform == "win32":
    celery_app.conf.worker_pool = "solo"


@celery_app.task(bind=True, max_retries=3)
def process_document_task(self, job_id: str):
    logger.info("[processing] job_id=%s task_started", job_id)
    supabase = get_supabase_admin_client()

    try:
        job_response = supabase.table("processing_jobs").select(
            "*, documents(*), output_templates(*)"
        ).eq("id", job_id).maybe_single().execute()

        if not job_response.data:
            logger.error("[processing] job_id=%s job_not_found", job_id)
            raise Exception("Job not found")

        job = job_response.data
        document = job["documents"]
        template = job.get("output_templates")
        doc_id = document.get("id") if document else None
        template_id = template.get("id") if template else None
        logger.info(
            "[processing] job_id=%s job_loaded document_id=%s template_id=%s",
            job_id, doc_id, template_id
        )

        supabase.table("processing_jobs").update({
            "status": "processing",
            "started_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()
        logger.info("[processing] job_id=%s status=processing", job_id)

        storage_path = document.get("storage_path") or document.get("file_path")
        file_url = storage_service.supabase.storage.from_(
            settings.STORAGE_BUCKET_NAME
        ).create_signed_url(storage_path, 3600)

        response = httpx.get(file_url["signedURL"])
        response.raise_for_status()
        file_content = response.content
        logger.info(
            "[processing] job_id=%s file_downloaded size=%s bytes",
            job_id, len(file_content)
        )

        output_format = template["output_format"] if template else "json"
        schema = template["schema"] if template else None
        custom_instructions = job.get("custom_instructions", "")
        file_name = document.get("filename", "document")

        logger.info(
            "[processing] job_id=%s calling_gemini output_format=%s file_name=%s",
            job_id, output_format, file_name
        )
        logger.info("--------------------------------")
        logger.info(f"schema: {schema}")
        logger.info("--------------------------------")
        gemini_result = gemini_service.process_document(
            file_content=file_content,
            mime_type=document.get("file_type") or document.get("mime_type"),
            output_format=output_format,
            schema=schema,
            custom_instructions=custom_instructions,
            file_name=file_name,
        )

        if not gemini_result["success"]:
            err = gemini_result.get("error", "Processing failed")
            logger.error("[processing] job_id=%s gemini_failed error=%s", job_id, err)
            raise Exception(err)

        output_data = gemini_result["output"]
        tokens_used = gemini_result["tokens_used"]
        model_used = gemini_result.get("model", "gemini-2.5-flash")
        logger.info(
            "[processing] job_id=%s gemini_done tokens_used=%s model=%s",
            job_id, tokens_used, model_used
        )

        created = datetime.fromisoformat(job["created_at"].replace("Z", "+00:00"))
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        processing_time = int((datetime.now(timezone.utc) - created).total_seconds())

        doc_mime = document.get("file_type") or document.get("mime_type") or "application/octet-stream"
        result_data = {
            "job_id": job_id,
            "processing_job_id": job_id,  # some schemas use this name for the FK
            "output_format": output_format,
            "format": output_format,  # some schemas use "format" NOT NULL instead of output_format
            "mime_type": doc_mime,  # some schemas require mime_type NOT NULL
            "tokens_used": tokens_used,
            "processing_time": processing_time,
            "model_used": model_used,
        }

        if output_format == "text":
            result_data["output_text"] = output_data
        elif output_format == "json":
            result_data["output_data"] = output_data
        elif output_format == "excel":
            logger.info("[processing] job_id=%s generating_excel", job_id)
            excel_url = output_formatter.generate_excel(
                data=output_data,
                columns=schema.get("columns", []) if schema else [],
                job_id=job_id
            )
            result_data["output_file_url"] = excel_url
            result_data["output_data"] = output_data
            logger.info("[processing] job_id=%s excel_done url=%s", job_id, excel_url)

        logger.info("[processing] job_id=%s inserting_result", job_id)
        result_response = _insert_processing_result(supabase, result_data, output_format, output_data)

        supabase.table("processing_jobs").update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()
        logger.info(
            "[processing] job_id=%s completed result_id=%s",
            job_id, result_response.data[0]["id"]
        )

        _trigger_webhooks(job_id, "job.completed", result_response.data[0])

        return {
            "job_id": job_id,
            "status": "completed",
            "result_id": result_response.data[0]["id"]
        }

    except Exception as e:
        error_message = str(e)
        retries = getattr(self.request, "retries", 0)
        logger.exception(
            "[processing] job_id=%s error step=failed exception=%s retries=%s",
            job_id, type(e).__name__, retries
        )
        logger.error("[processing] job_id=%s error_message=%s", job_id, error_message)

        # Gemini 429: retry with API-suggested delay; only mark failed when out of retries
        is_429 = False
        countdown = 60 * (retries + 1)
        try:
            from google.genai import errors as genai_errors
            if isinstance(e, genai_errors.ClientError) and getattr(e, "code", None) == 429:
                is_429 = True
                # Prefer RetryInfo from details, else parse "retry in Xs" from message
                countdown = 60
                details = getattr(e, "details", None) or {}
                err = details.get("error", {}) if isinstance(details, dict) else {}
                details_list = err.get("details", []) if isinstance(err, dict) else []
                for item in details_list:
                    if isinstance(item, dict) and item.get("@type") == "type.googleapis.com/google.rpc.RetryInfo":
                        delay = item.get("retryDelay", "60s")
                        if isinstance(delay, str) and delay.endswith("s"):
                            countdown = min(300, max(45, int(float(delay[:-1]))))
                        break
                if countdown == 60 and (getattr(e, "message", None) or error_message):
                    msg = getattr(e, "message", None) or error_message
                    m = re.search(r"retry in (\d+(?:\.\d+)?)\s*s", msg, re.I)
                    if m:
                        countdown = min(300, max(45, int(float(m.group(1)))))
                logger.warning(
                    "[processing] job_id=%s rate_limit_429 retry_in=%ss attempt=%s",
                    job_id, countdown, retries + 1
                )
        except Exception:
            pass

        if is_429 and retries < self.max_retries:
            # Do not mark job failed; keep processing and retry
            supabase.table("processing_jobs").update({
                "error_message": f"Rate limit exceeded. Retrying in {countdown}s…"
            }).eq("id", job_id).execute()
            raise self.retry(exc=e, countdown=countdown)

        logger.error("[processing] job_id=%s marking_failed", job_id)
        supabase.table("processing_jobs").update({
            "status": "failed",
            "error_message": _user_friendly_error(error_message, is_429),
            "completed_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()

        _trigger_webhooks(job_id, "job.failed", {"error": error_message})

        if retries < self.max_retries:
            logger.info("[processing] job_id=%s retrying countdown=%s", job_id, countdown)
            raise self.retry(exc=e, countdown=countdown)


def _insert_processing_result(supabase, result_data: Dict[str, Any], output_format: str, output_data: Any):
    """Insert into processing_results; on PGRST204 (missing column), omit that column and retry."""
    job_id = result_data.get("job_id", "")
    data = dict(result_data)
    attempt = 0
    max_attempts = 5
    while attempt < max_attempts:
        try:
            out = supabase.table("processing_results").insert(data).execute()
            logger.info("[processing] job_id=%s insert_result ok attempt=%s", job_id, attempt + 1)
            return out
        except PostgrestAPIError as e:
            if getattr(e, "code", None) != "PGRST204":
                logger.exception(
                    "[processing] job_id=%s insert_result postgrest_error code=%s",
                    job_id, getattr(e, "code", None)
                )
                raise
            msg = (e.message or "") or ""
            m = re.search(r"Could not find the ['\"]?(\w+)['\"]? column", msg, re.I)
            if not m:
                raise
            bad_col = m.group(1)
            data.pop(bad_col, None)
            if bad_col == "output_data" and output_format == "json" and "output_text" not in data:
                data["output_text"] = json.dumps(output_data, ensure_ascii=False)
            # Never remove job_id (required to find result); processing_job_id is optional alias
            if bad_col == "job_id":
                logger.error("[processing] job_id=%s insert_result cannot_remove_job_id", job_id)
                raise
            attempt += 1
            logger.warning(
                "[processing] job_id=%s insert_result column_missing dropped=%s attempt=%s",
                job_id, bad_col, attempt
            )
    logger.error("[processing] job_id=%s insert_result max_attempts_exceeded", job_id)
    raise RuntimeError("Could not insert processing_result: missing columns in schema")


def _user_friendly_error(raw: str, is_quota: bool = False) -> str:
    if is_quota or "429" in raw or "quota" in raw.lower() or "RESOURCE_EXHAUSTED" in raw:
        return (
            "Gemini API quota exceeded. Check your plan and billing at "
            "https://ai.google.dev/gemini-api/docs/rate-limits or try again later."
        )
    return raw


def _trigger_webhooks(job_id: str, event_type: str, payload: Dict[str, Any]):
    supabase = get_supabase_admin_client()

    try:
        job_response = supabase.table("processing_jobs").select(
            "organization_id, user_id"
        ).eq("id", job_id).maybe_single().execute()

        if not job_response.data:
            return

        job = job_response.data

        webhooks_response = supabase.table("webhooks").select("*").eq(
            "organization_id", job["organization_id"]
        ).eq("is_active", True).execute()

        for webhook in webhooks_response.data:
            if event_type in webhook["events"]:
                _deliver_webhook(webhook, job_id, event_type, payload)
        if webhooks_response.data:
            logger.debug(
                "[processing] job_id=%s webhooks_triggered event=%s count=%s",
                job_id, event_type, len([w for w in webhooks_response.data if event_type in w["events"]])
            )

    except Exception as e:
        logger.warning("[processing] job_id=%s webhook_trigger_error error=%s", job_id, str(e))


def _deliver_webhook(webhook: Dict[str, Any], job_id: str, event_type: str, payload: Dict[str, Any]):
    supabase = get_supabase_admin_client()

    webhook_payload = {
        "event": event_type,
        "job_id": job_id,
        "data": payload,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    signature = _generate_webhook_signature(webhook["secret"], webhook_payload)

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": event_type
    }

    delivery_record = {
        "webhook_id": webhook["id"],
        "job_id": job_id,
        "event_type": event_type,
        "payload": webhook_payload,
        "attempt_count": 1
    }

    try:
        response = httpx.post(
            webhook["url"],
            json=webhook_payload,
            headers=headers,
            timeout=30
        )

        delivery_record["response_status"] = response.status_code
        delivery_record["response_body"] = response.text[:1000]

        if 200 <= response.status_code < 300:
            delivery_record["delivered_at"] = datetime.now(timezone.utc).isoformat()

    except Exception as e:
        delivery_record["response_status"] = 0
        delivery_record["response_body"] = str(e)[:1000]

    supabase.table("webhook_deliveries").insert(delivery_record).execute()


def _generate_webhook_signature(secret: str, payload: Dict[str, Any]) -> str:
    import json
    payload_str = json.dumps(payload, sort_keys=True)
    signature = hmac.new(
        secret.encode(),
        payload_str.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature


class ProcessingService:
    def __init__(self):
        self.supabase = get_supabase_admin_client()

    def create_job(
        self,
        user_id: str,
        organization_id: str,
        document_id: str,
        template_id: str = None,
        custom_instructions: str = "",
        priority: int = 0
    ) -> Dict[str, Any]:
        job_data = {
            "user_id": user_id,
            "organization_id": organization_id,
            "document_id": document_id,
            "template_id": template_id,
            "custom_instructions": custom_instructions or "",
            "status": "pending"
        }
        # Retry without priority if table doesn't have that column (PGRST204)
        try:
            job_response = self.supabase.table("processing_jobs").insert({**job_data, "priority": priority}).execute()
        except PostgrestAPIError as e:
            err_msg = (e.message or "") or ""
            if getattr(e, "code", None) == "PGRST204" or "priority" in err_msg.lower():
                job_response = self.supabase.table("processing_jobs").insert(job_data).execute()
            else:
                raise

        job = job_response.data[0]

        process_document_task.apply_async(
            args=[job["id"]],
            priority=priority
        )

        return job

    def cancel_job(self, job_id: str, user_id: str) -> bool:
        job_response = self.supabase.table("processing_jobs").select(
            "*"
        ).eq("id", job_id).eq("user_id", user_id).maybe_single().execute()

        if not job_response.data:
            return False

        job = job_response.data

        if job["status"] in ["completed", "failed", "cancelled"]:
            return False

        self.supabase.table("processing_jobs").update({
            "status": "cancelled",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()

        celery_app.control.revoke(job_id, terminate=True)

        return True

    def retry_job(self, job_id: str, user_id: str) -> Dict[str, Any] | None:
        """Re-queue a failed/cancelled job, or clone a new job from a completed one. Returns job or None."""
        job_response = self.supabase.table("processing_jobs").select("*").eq(
            "id", job_id
        ).eq("user_id", user_id).maybe_single().execute()

        if not job_response.data:
            return None

        job = job_response.data
        status = job.get("status")

        if status in ("failed", "cancelled"):
            # Re-use same job: reset and re-queue
            update_data = {
                "status": "pending",
                "error_message": None,
                "started_at": None,
                "completed_at": None,
            }
            self.supabase.table("processing_jobs").update(update_data).eq(
                "id", job_id
            ).execute()
            priority = job.get("priority", 0) or 0
            process_document_task.apply_async(args=[job_id], priority=priority)
            updated = self.supabase.table("processing_jobs").select("*").eq(
                "id", job_id
            ).maybe_single().execute()
            return updated.data

        if status == "completed":
            # Clone: create a new job with same document, template, instructions
            org_id = job.get("organization_id")
            doc_id = job.get("document_id")
            template_id = job.get("template_id")
            instructions = job.get("custom_instructions") or ""
            priority = job.get("priority", 0) or 0
            if not doc_id:
                return None
            new_job = self.create_job(
                user_id=user_id,
                organization_id=org_id,
                document_id=doc_id,
                template_id=template_id,
                custom_instructions=instructions,
                priority=priority,
            )
            logger.info(
                "[processing] job_id=%s clone_completed new_job_id=%s",
                job_id, new_job["id"]
            )
            return new_job

        return None


processing_service = ProcessingService()
