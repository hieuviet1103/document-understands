from celery import Celery
from postgrest.exceptions import APIError as PostgrestAPIError
from app.core.config import settings
from app.core.supabase import get_supabase_admin_client
from app.services.gemini import gemini_service
from app.services.storage import storage_service
from app.services.output_formatter import output_formatter
from typing import Dict, Any
import httpx
import hashlib
import hmac
import json
import re
import sys
from datetime import datetime, timezone


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
    supabase = get_supabase_admin_client()

    try:
        job_response = supabase.table("processing_jobs").select(
            "*, documents(*), output_templates(*)"
        ).eq("id", job_id).maybe_single().execute()

        if not job_response.data:
            raise Exception("Job not found")

        job = job_response.data
        document = job["documents"]
        template = job.get("output_templates")

        supabase.table("processing_jobs").update({
            "status": "processing",
            "started_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()

        file_url = storage_service.supabase.storage.from_(
            settings.STORAGE_BUCKET_NAME
        ).create_signed_url(document.get("storage_path") or document.get("file_path"), 3600)

        response = httpx.get(file_url["signedURL"])
        file_content = response.content

        output_format = template["output_format"] if template else "json"
        schema = template["schema"] if template else None
        custom_instructions = job.get("custom_instructions", "")

        gemini_result = gemini_service.process_document(
            file_content=file_content,
            mime_type=document.get("file_type") or document.get("mime_type"),
            output_format=output_format,
            schema=schema,
            custom_instructions=custom_instructions,
            file_name=document.get("filename", "document"),
        )

        if not gemini_result["success"]:
            raise Exception(gemini_result.get("error", "Processing failed"))

        output_data = gemini_result["output"]
        tokens_used = gemini_result["tokens_used"]
        model_used = gemini_result.get("model", "gemini-2.5-flash")

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
            excel_url = output_formatter.generate_excel(
                data=output_data,
                columns=schema.get("columns", []) if schema else [],
                job_id=job_id
            )
            result_data["output_file_url"] = excel_url
            result_data["output_data"] = output_data

        result_response = _insert_processing_result(supabase, result_data, output_format, output_data)

        supabase.table("processing_jobs").update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()

        _trigger_webhooks(job_id, "job.completed", result_response.data[0])

        return {
            "job_id": job_id,
            "status": "completed",
            "result_id": result_response.data[0]["id"]
        }

    except Exception as e:
        error_message = str(e)
        # Gemini 429: retry with API-suggested delay; only mark failed when out of retries
        is_429 = False
        countdown = 60 * (self.request.retries + 1)
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
        except Exception:
            pass

        if is_429 and self.request.retries < self.max_retries:
            # Do not mark job failed; keep processing and retry
            supabase.table("processing_jobs").update({
                "error_message": f"Rate limit exceeded. Retrying in {countdown}s…"
            }).eq("id", job_id).execute()
            raise self.retry(exc=e, countdown=countdown)

        supabase.table("processing_jobs").update({
            "status": "failed",
            "error_message": _user_friendly_error(error_message, is_429),
            "completed_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()

        _trigger_webhooks(job_id, "job.failed", {"error": error_message})

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=countdown)


def _insert_processing_result(supabase, result_data: Dict[str, Any], output_format: str, output_data: Any):
    """Insert into processing_results; on PGRST204 (missing column), omit that column and retry."""
    data = dict(result_data)
    attempt = 0
    max_attempts = 5
    while attempt < max_attempts:
        try:
            return supabase.table("processing_results").insert(data).execute()
        except PostgrestAPIError as e:
            if getattr(e, "code", None) != "PGRST204":
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
                raise
            attempt += 1
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

    except Exception as e:
        print(f"Webhook trigger error: {str(e)}")


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
        """Re-queue a failed or cancelled job. Returns updated job or None if not allowed."""
        job_response = self.supabase.table("processing_jobs").select("*").eq(
            "id", job_id
        ).eq("user_id", user_id).maybe_single().execute()

        if not job_response.data:
            return None

        job = job_response.data
        if job["status"] not in ("failed", "cancelled"):
            return None

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


processing_service = ProcessingService()
