from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.core.auth import get_current_user
from app.core.supabase import get_supabase_admin_client
from app.services.storage import storage_service
from app.models.schemas import DocumentUploadResponse, DocumentResponse
from typing import List, Dict, Any

router = APIRouter()


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    organization_id = current_user["profile"]["organization_id"]

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
    # DB may have column "file_path" (NOT NULL) alongside or instead of "storage_path"
    if "file_path" not in document_data:
        document_data["file_path"] = storage_path
    # DB may have column "mime_type" (NOT NULL) alongside or instead of "file_type"
    if "mime_type" not in document_data:
        document_data["mime_type"] = file.content_type

    response = supabase.table("documents").insert(document_data).execute()

    return response.data[0]


@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    limit: int = 50,
    offset: int = 0,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    response = supabase.table("documents").select("*").eq(
        "organization_id", organization_id
    ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()

    return response.data


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    response = supabase.table("documents").select("*").eq(
        "id", document_id
    ).eq("organization_id", organization_id).maybe_single().execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Document not found")

    return response.data


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    supabase = get_supabase_admin_client()

    document_response = supabase.table("documents").select("*").eq(
        "id", document_id
    ).eq("user_id", user_id).maybe_single().execute()

    if not document_response.data:
        raise HTTPException(status_code=404, detail="Document not found")

    document = document_response.data

    await storage_service.delete_file(document.get("storage_path") or document.get("file_path"))

    supabase.table("documents").delete().eq("id", document_id).execute()

    return {"success": True, "message": "Document deleted successfully"}
