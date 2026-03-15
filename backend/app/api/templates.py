from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user
from app.core.supabase import get_supabase_admin_client
from app.models.schemas import TemplateCreate, TemplateUpdate, TemplateResponse
from typing import List, Dict, Any

router = APIRouter()


@router.post("", response_model=TemplateResponse)
async def create_template(
    template: TemplateCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    template_data = template.model_dump(by_alias=True)
    template_data["user_id"] = user_id
    template_data["organization_id"] = organization_id
    # DB may have column "format" (NOT NULL) alongside or instead of "output_format"
    if "output_format" in template_data and "format" not in template_data:
        template_data["format"] = template_data["output_format"]

    response = supabase.table("output_templates").insert(template_data).execute()

    return response.data[0]


@router.get("", response_model=List[TemplateResponse])
async def list_templates(
    limit: int = 50,
    offset: int = 0,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    response = supabase.table("output_templates").select("*").or_(
        f"organization_id.eq.{organization_id},is_public.eq.true"
    ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()

    return response.data


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    response = supabase.table("output_templates").select("*").eq(
        "id", template_id
    ).or_(f"organization_id.eq.{organization_id},is_public.eq.true").maybe_single().execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Template not found")

    return response.data


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str,
    template: TemplateUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    supabase = get_supabase_admin_client()

    existing = supabase.table("output_templates").select("*").eq(
        "id", template_id
    ).eq("user_id", user_id).maybe_single().execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = template.model_dump(exclude_unset=True, by_alias=True)
    if "output_format" in update_data and "format" not in update_data:
        update_data["format"] = update_data["output_format"]

    response = supabase.table("output_templates").update(update_data).eq(
        "id", template_id
    ).execute()

    return response.data[0]


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    supabase = get_supabase_admin_client()

    existing = supabase.table("output_templates").select("*").eq(
        "id", template_id
    ).eq("user_id", user_id).maybe_single().execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Template not found")

    supabase.table("output_templates").delete().eq("id", template_id).execute()

    return {"success": True, "message": "Template deleted successfully"}
