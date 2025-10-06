from celery import Celery
from app.core.config import settings
from app.core.supabase import get_supabase_admin_client
from app.services.gemini import gemini_service
from app.services.storage import storage_service
from app.services.output_formatter import output_formatter
from typing import Dict, Any
import httpx
import hashlib
import hmac
from datetime import datetime


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
)


@celery_app.task(bind=True, max_retries=3)
def process_document_task(self, job_id: str):
    supabase = get_supabase_admin_client()

    try:
        job_response = supabase.table("processing_jobs").select(
            "*, documents(*), output_templates(*)"
        ).eq("id", job_id).maybeSingle().execute()

        if not job_response.data:
            raise Exception("Job not found")

        job = job_response.data
        document = job["documents"]
        template = job.get("output_templates")

        supabase.table("processing_jobs").update({
            "status": "processing",
            "started_at": datetime.utcnow().isoformat()
        }).eq("id", job_id).execute()

        file_url = storage_service.supabase.storage.from_(
            settings.STORAGE_BUCKET_NAME
        ).create_signed_url(document["storage_path"], 3600)

        response = httpx.get(file_url["signedURL"])
        file_content = response.content

        output_format = template["output_format"] if template else "json"
        schema = template["schema"] if template else None
        custom_instructions = job.get("custom_instructions", "")

        gemini_result = gemini_service.process_document(
            file_content=file_content,
            mime_type=document["file_type"],
            output_format=output_format,
            schema=schema,
            custom_instructions=custom_instructions
        )

        if not gemini_result["success"]:
            raise Exception(gemini_result.get("error", "Processing failed"))

        output_data = gemini_result["output"]
        tokens_used = gemini_result["tokens_used"]

        processing_time = (datetime.utcnow() - datetime.fromisoformat(job["created_at"].replace("Z", "+00:00"))).seconds

        result_data = {
            "job_id": job_id,
            "output_format": output_format,
            "tokens_used": tokens_used,
            "processing_time": processing_time
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

        result_response = supabase.table("processing_results").insert(result_data).execute()

        supabase.table("processing_jobs").update({
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", job_id).execute()

        _trigger_webhooks(job_id, "job.completed", result_response.data[0])

        return {
            "job_id": job_id,
            "status": "completed",
            "result_id": result_response.data[0]["id"]
        }

    except Exception as e:
        error_message = str(e)

        supabase.table("processing_jobs").update({
            "status": "failed",
            "error_message": error_message,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", job_id).execute()

        _trigger_webhooks(job_id, "job.failed", {"error": error_message})

        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))


def _trigger_webhooks(job_id: str, event_type: str, payload: Dict[str, Any]):
    supabase = get_supabase_admin_client()

    try:
        job_response = supabase.table("processing_jobs").select(
            "organization_id, user_id"
        ).eq("id", job_id).maybeSingle().execute()

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
        "timestamp": datetime.utcnow().isoformat()
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
            delivery_record["delivered_at"] = datetime.utcnow().isoformat()

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
            "custom_instructions": custom_instructions,
            "priority": priority,
            "status": "pending"
        }

        job_response = self.supabase.table("processing_jobs").insert(job_data).execute()

        job = job_response.data[0]

        process_document_task.apply_async(
            args=[job["id"]],
            priority=priority
        )

        return job

    def cancel_job(self, job_id: str, user_id: str) -> bool:
        job_response = self.supabase.table("processing_jobs").select(
            "*"
        ).eq("id", job_id).eq("user_id", user_id).maybeSingle().execute()

        if not job_response.data:
            return False

        job = job_response.data

        if job["status"] in ["completed", "failed", "cancelled"]:
            return False

        self.supabase.table("processing_jobs").update({
            "status": "cancelled",
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", job_id).execute()

        celery_app.control.revoke(job_id, terminate=True)

        return True


processing_service = ProcessingService()
