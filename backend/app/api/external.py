from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.core.auth import get_api_key_user
from app.core.supabase import get_supabase_admin_client
from app.services.storage import storage_service
from app.services.processing import processing_service
from app.models.schemas import (
    ExternalProcessRequest,
    ExternalProcessResponse,
    ProcessingJobResponse,
    ProcessingResultResponse,
    JobStatus
)
from typing import Dict, Any

router = APIRouter()


@router.post("/process", response_model=ExternalProcessResponse)
async def process_document_external(
    file: UploadFile = File(...),
    template_id: str = None,
    custom_instructions: str = "",
    api_key_user: Dict[str, Any] = Depends(get_api_key_user)
):
    user_id = api_key_user["user_id"]
    organization_id = api_key_user["organization_id"]

    await storage_service.ensure_bucket_exists()

    file_content = await file.read()
    await file.seek(0)

    storage_path, thumbnail_url = await storage_service.upload_file(
        file, user_id, organization_id
    )

    metadata = await storage_service.extract_metadata(file, file_content)

    supabase = get_supabase_admin_client()

    document_data = {
        "user_id": user_id,
        "organization_id": organization_id,
        "filename": file.filename,
        "file_type": file.content_type,
        "file_size": len(file_content),
        "storage_path": storage_path,
        "thumbnail_url": thumbnail_url,
        "metadata": metadata,
        "status": "uploaded"
    }
    if "file_path" not in document_data:
        document_data["file_path"] = storage_path
    if "mime_type" not in document_data:
        document_data["mime_type"] = file.content_type

    doc_response = supabase.table("documents").insert(document_data).execute()
    document = doc_response.data[0]

    job = processing_service.create_job(
        user_id=user_id,
        organization_id=organization_id,
        document_id=document["id"],
        template_id=template_id,
        custom_instructions=custom_instructions,
        priority=0
    )

    return {
        "job_id": job["id"],
        "status": JobStatus(job["status"]),
        "message": "Document uploaded and processing started",
        "estimated_completion": 60
    }


@router.get("/jobs/{job_id}", response_model=ProcessingJobResponse)
async def get_job_status_external(
    job_id: str,
    api_key_user: Dict[str, Any] = Depends(get_api_key_user)
):
    organization_id = api_key_user["organization_id"]
    supabase = get_supabase_admin_client()

    response = supabase.table("processing_jobs").select("*").eq(
        "id", job_id
    ).eq("organization_id", organization_id).maybe_single().execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Job not found")

    return response.data


@router.get("/jobs/{job_id}/result", response_model=ProcessingResultResponse)
async def get_job_result_external(
    job_id: str,
    api_key_user: Dict[str, Any] = Depends(get_api_key_user)
):
    organization_id = api_key_user["organization_id"]
    supabase = get_supabase_admin_client()

    job_response = supabase.table("processing_jobs").select("*").eq(
        "id", job_id
    ).eq("organization_id", organization_id).maybe_single().execute()

    if not job_response.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = job_response.data

    if job["status"] not in ["completed", "failed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Job is still {job['status']}"
        )

    result_response = supabase.table("processing_results").select("*").eq(
        "job_id", job_id
    ).maybe_single().execute()

    if not result_response.data:
        raise HTTPException(status_code=404, detail="Result not available")

    return result_response.data
