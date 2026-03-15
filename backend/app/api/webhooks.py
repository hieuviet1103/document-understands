from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user, generate_webhook_secret
from app.core.supabase import get_supabase_admin_client
from app.models.schemas import WebhookCreate, WebhookUpdate, WebhookResponse, WebhookDeliveryResponse
from typing import List, Dict, Any

router = APIRouter()


@router.post("", response_model=WebhookResponse)
async def create_webhook(
    webhook: WebhookCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    organization_id = current_user["profile"]["organization_id"]

    secret = generate_webhook_secret()

    supabase = get_supabase_admin_client()

    webhook_data = {
        "user_id": user_id,
        "organization_id": organization_id,
        "url": webhook.url,
        "events": webhook.events,
        "secret": secret,
        "is_active": True,
    }
    if webhook.template_id is not None:
        webhook_data["template_id"] = webhook.template_id

    response = supabase.table("webhooks").insert(webhook_data).execute()
    row = response.data[0]
    # Ensure updated_at for response (DB may not return it if column missing)
    if row.get("updated_at") is None and row.get("created_at"):
        row = {**row, "updated_at": row["created_at"]}
    return row


@router.get("", response_model=List[WebhookResponse])
async def list_webhooks(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    response = supabase.table("webhooks").select("*").eq(
        "organization_id", organization_id
    ).order("created_at", desc=True).execute()

    return response.data


@router.get("/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    response = supabase.table("webhooks").select("*").eq(
        "id", webhook_id
    ).eq("organization_id", organization_id).maybe_single().execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Webhook not found")

    return response.data


@router.put("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: str,
    webhook: WebhookUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    supabase = get_supabase_admin_client()

    existing = supabase.table("webhooks").select("*").eq(
        "id", webhook_id
    ).eq("user_id", user_id).maybe_single().execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Webhook not found")

    update_data = webhook.model_dump(exclude_unset=True)

    response = supabase.table("webhooks").update(update_data).eq(
        "id", webhook_id
    ).execute()

    return response.data[0]


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    supabase = get_supabase_admin_client()

    existing = supabase.table("webhooks").select("*").eq(
        "id", webhook_id
    ).eq("user_id", user_id).maybe_single().execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Webhook not found")

    supabase.table("webhooks").delete().eq("id", webhook_id).execute()

    return {"success": True, "message": "Webhook deleted successfully"}


@router.get("/{webhook_id}/deliveries", response_model=List[WebhookDeliveryResponse])
async def list_webhook_deliveries(
    webhook_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    organization_id = current_user["profile"]["organization_id"]
    supabase = get_supabase_admin_client()

    webhook_response = supabase.table("webhooks").select("*").eq(
        "id", webhook_id
    ).eq("organization_id", organization_id).maybe_single().execute()

    if not webhook_response.data:
        raise HTTPException(status_code=404, detail="Webhook not found")

    response = supabase.table("webhook_deliveries").select("*").eq(
        "webhook_id", webhook_id
    ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()

    return response.data
