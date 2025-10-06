from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user
from app.core.supabase import get_supabase_admin_client
from app.services.processing import processing_service
from app.models.schemas import ProcessingJobCreate, ProcessingJobResponse, ProcessingResultResponse
from typing import List, Dict, Any

router = APIRouter()


@router.post("", response_model=ProcessingJobResponse)
async def create_job(
    job_data: ProcessingJobCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    response = supabase.table("processing_jobs").select("*").eq(
        "id", job_id
    ).eq("organization_id", organization_id).maybeSingle().execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Job not found")

    return response.data


@router.get("/{job_id}/result", response_model=ProcessingResultResponse)
async def get_job_result(
    job_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    job_response = supabase.table("processing_jobs").select("*").eq(
        "id", job_id
    ).eq("organization_id", organization_id).maybeSingle().execute()

    if not job_response.data:
        raise HTTPException(status_code=404, detail="Job not found")

    result_response = supabase.table("processing_results").select("*").eq(
        "job_id", job_id
    ).maybeSingle().execute()

    if not result_response.data:
        raise HTTPException(status_code=404, detail="Result not yet available")

    return result_response.data


@router.post("/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    success = processing_service.cancel_job(job_id, user_id)

    if not success:
        raise HTTPException(
            status_code=400,
            detail="Job cannot be cancelled or not found"
        )

    return {"success": True, "message": "Job cancelled successfully"}
