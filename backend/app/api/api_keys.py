from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user, generate_api_key, require_role
from app.core.supabase import get_supabase_admin_client
from app.models.schemas import APIKeyCreate, APIKeyResponse, APIKeyCreateResponse, UserRole
from typing import List, Dict, Any

router = APIRouter()


@router.post("", response_model=APIKeyCreateResponse, dependencies=[Depends(require_role([UserRole.ADMIN]))])
async def create_api_key(
    key_data: APIKeyCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    organization_id = current_user["profile"]["organization_id"]

    api_key, key_hash, key_prefix = generate_api_key()

    supabase = get_supabase_admin_client()

    key_record = {
        "user_id": user_id,
        "organization_id": organization_id,
        "name": key_data.name,
        "key_hash": key_hash,
        "key_prefix": key_prefix,
        "scopes": key_data.scopes,
        "rate_limit": key_data.rate_limit,
        "expires_at": key_data.expires_at.isoformat() if key_data.expires_at else None,
        "is_active": True
    }

    response = supabase.table("api_keys").insert(key_record).execute()

    result = response.data[0]
    result["api_key"] = api_key

    return result


@router.get("", response_model=List[APIKeyResponse])
async def list_api_keys(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    response = supabase.table("api_keys").select("*").eq(
        "organization_id", organization_id
    ).order("created_at", desc=True).execute()

    return response.data


@router.delete("/{key_id}", dependencies=[Depends(require_role([UserRole.ADMIN]))])
async def delete_api_key(
    key_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    existing = supabase.table("api_keys").select("*").eq(
        "id", key_id
    ).eq("organization_id", organization_id).maybe_single().execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="API key not found")

    supabase.table("api_keys").delete().eq("id", key_id).execute()

    return {"success": True, "message": "API key deleted successfully"}
