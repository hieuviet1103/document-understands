import json
from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError as PostgrestAPIError
from app.core.auth import get_current_user_or_api_key
from app.core.supabase import get_supabase_admin_client
from app.services.processing import processing_service
from app.models.schemas import ProcessingJobCreate, ProcessingJobResponse, ProcessingResultResponse
from typing import List, Dict, Any

router = APIRouter()


@router.post("", response_model=ProcessingJobResponse)
async def create_job(
    job_data: ProcessingJobCreate,
    current_user: Dict[str, Any] = Depends(get_current_user_or_api_key)
):
    user_id = current_user["user_id"]
    organization_id = current_user["profile"]["organization_id"]

    job = processing_service.create_job(
        user_id=user_id,
        organization_id=organization_id,
        document_id=job_data.document_id,
        template_id=job_data.template_id,
        custom_instructions=job_data.custom_instructions,
        priority=job_data.priority
    )

    return job


@router.get("", response_model=List[ProcessingJobResponse])
async def list_jobs(
    status: str = None,
    limit: int = 50,
    offset: int = 0,
    current_user: Dict[str, Any] = Depends(get_current_user_or_api_key)
):
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    query = supabase.table("processing_jobs").select("*").eq(
        "organization_id", organization_id
    )

    if status:
        query = query.eq("status", status)

    response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()

    return response.data


@router.get("/{job_id}", response_model=ProcessingJobResponse)
async def get_job(
    job_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_or_api_key)
):
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    response = supabase.table("processing_jobs").select("*").eq(
        "id", job_id
    ).eq("organization_id", organization_id).maybe_single().execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Job not found")

    return response.data


@router.get("/{job_id}/result", response_model=ProcessingResultResponse)
async def get_job_result(
    job_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_or_api_key)
):
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    job_response = supabase.table("processing_jobs").select("*").eq(
        "id", job_id
    ).eq("organization_id", organization_id).maybe_single().execute()

    if not job_response.data:
        raise HTTPException(status_code=404, detail="Job not found")

    result_data = None
    for col in ("job_id", "processing_job_id"):
        try:
            result_response = supabase.table("processing_results").select("*").eq(
                col, job_id
            ).limit(1).execute()
            if result_response.data and len(result_response.data) > 0:
                result_data = result_response.data[0]
                break
        except PostgrestAPIError as e:
            if getattr(e, "code", None) == "204" or "Missing response" in str(e.message or ""):
                continue
            if getattr(e, "code", None) == "PGRST204":
                continue
            raise

    if not result_data:
        raise HTTPException(status_code=404, detail="Result not yet available")

    # Normalize for schemas that use "format" instead of "output_format" or omit tokens_used/processing_time
    out = dict(result_data)
    out.setdefault("output_format", out.get("format"))
    out.setdefault("tokens_used", 0)
    out.setdefault("processing_time", 0)
    # Ensure JSON results always have output_data (dict) for the UI
    if out.get("output_format") == "json":
        raw = out.get("output_data")
        if raw is None and out.get("output_text"):
            try:
                out["output_data"] = json.loads(out["output_text"])
            except (TypeError, json.JSONDecodeError):
                pass
        elif isinstance(raw, str):
            try:
                out["output_data"] = json.loads(raw)
            except (TypeError, json.JSONDecodeError):
                pass
    return out


@router.post("/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_or_api_key)
):
    user_id = current_user["user_id"]

    success = processing_service.cancel_job(job_id, user_id)

    if not success:
        raise HTTPException(
            status_code=400,
            detail="Job cannot be cancelled or not found"
        )

    return {"success": True, "message": "Job cancelled successfully"}


@router.post("/{job_id}/retry", response_model=ProcessingJobResponse)
async def retry_job(
    job_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_or_api_key)
):
    user_id = current_user["user_id"]
    job = processing_service.retry_job(job_id, user_id)
    if not job:
        raise HTTPException(
            status_code=400,
            detail="Job not found or cannot be retried (allowed: failed, cancelled, or completed)"
        )
    return job
