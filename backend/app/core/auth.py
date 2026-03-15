from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
from app.core.supabase import get_supabase_admin_client
from app.core.config import settings
from app.models.schemas import UserRole
import hashlib
import secrets
import httpx


security = HTTPBearer()

# Default org used when auto-creating profile (must match create_admin.py)
DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001"


def _get_user_from_token(token: str) -> Dict[str, Any]:
    """Validate JWT and return user dict by calling Supabase Auth API (no supabase-py auth)."""
    url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user"
    # Use anon key so the user's JWT (issued for this project) is accepted; fallback to service_role
    apikey = getattr(settings, "SUPABASE_KEY", None) or settings.SUPABASE_SERVICE_ROLE_KEY
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": apikey,
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=10) as client:
        r = client.get(url, headers=headers)
    if r.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    try:
        data = r.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid auth response"
        )
    user_id = data.get("id")
    email = data.get("email") or ""
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    return {"id": user_id, "email": email}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    token = credentials.credentials
    supabase_admin = get_supabase_admin_client()

    try:
        auth_user = _get_user_from_token(token)
        user_id = auth_user["id"]

        # Use admin client so RLS does not block (backend has no user JWT in Supabase context)
        profile_response = supabase_admin.table("user_profiles").select("*").eq("id", user_id).maybe_single().execute()
        profile_data = getattr(profile_response, "data", None) if profile_response else None

        if isinstance(profile_data, dict):
            profile = profile_data
        elif profile_data and isinstance(profile_data, list) and len(profile_data) > 0:
            profile = profile_data[0] if isinstance(profile_data[0], dict) else None
        else:
            profile = None

        if not profile or (isinstance(profile, dict) and not profile.get("id")):
            # Auto-create user_profiles for users who have Auth account but no profile (e.g. signed up via UI)
            try:
                org_res = supabase_admin.table("organizations").select("id").eq("id", DEFAULT_ORG_ID).execute()
                org_list = getattr(org_res, "data", None) or []
                if not org_list:
                    # Try insert default org; if slug "default" exists, fetch by slug
                    try:
                        supabase_admin.table("organizations").insert({
                            "id": DEFAULT_ORG_ID,
                            "name": "Default Organization",
                            "slug": "default",
                        }).execute()
                        org_id = DEFAULT_ORG_ID
                    except Exception:
                        by_slug = supabase_admin.table("organizations").select("id").eq("slug", "default").limit(1).execute()
                        slug_data = getattr(by_slug, "data", None) or []
                        org_id = slug_data[0]["id"] if slug_data and isinstance(slug_data[0], dict) else DEFAULT_ORG_ID
                else:
                    org_id = org_list[0]["id"] if isinstance(org_list[0], dict) else org_list[0].get("id", DEFAULT_ORG_ID)
                display_name = ((auth_user.get("email") or "User").split("@")[0] or "User").strip() or "User"
                # Only required columns (settings may not exist in older schema)
                supabase_admin.table("user_profiles").insert({
                    "id": user_id,
                    "organization_id": org_id,
                    "role": "user",
                    "display_name": display_name,
                    "language": "en",
                }).execute()
                profile = {
                    "id": user_id,
                    "organization_id": org_id,
                    "role": "user",
                    "display_name": display_name,
                    "language": "en",
                    "settings": {},
                }
            except Exception as create_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Cannot auto-create profile: {str(create_err)}",
                )

        # If user has no organization (e.g. signed up before org flow), create default org and assign
        if not profile.get("organization_id"):
            org_slug = f"org-{str(user_id).replace('-', '')[:16]}"
            org_response = supabase_admin.table("organizations").insert({
                "name": profile.get("display_name", "My Organization"),
                "slug": org_slug,
            }).execute()
            org_res_data = getattr(org_response, "data", None) if org_response else None
            if org_res_data and len(org_res_data) > 0:
                org_id = org_res_data[0]["id"] if isinstance(org_res_data[0], dict) else getattr(org_res_data[0], "id", None)
                supabase_admin.table("user_profiles").update({
                    "organization_id": org_id,
                    "role": "admin",
                }).eq("id", user_id).execute()
                profile = {**profile, "organization_id": org_id, "role": "admin"}

        return {
            "user_id": user_id,
            "email": auth_user["email"],
            "profile": profile
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )


def require_role(required_roles: list[UserRole]):
    """Returns a FastAPI dependency that checks user has one of the required roles."""
    async def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = current_user["profile"]["role"]
        if user_role not in [role.value for role in required_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {[r.value for r in required_roles]}"
            )
        return current_user
    return role_checker


async def get_api_key_user(x_api_key: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required"
        )

    key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()

    supabase = get_supabase_admin_client()

    try:
        api_key_response = supabase.table("api_keys").select("*, user_profiles(*)").eq("key_hash", key_hash).eq("is_active", True).maybe_single().execute()

        if not api_key_response.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key"
            )

        api_key_data = api_key_response.data

        supabase.table("api_keys").update({
            "last_used_at": "now()"
        }).eq("id", api_key_data["id"]).execute()

        return {
            "user_id": api_key_data["user_id"],
            "organization_id": api_key_data["organization_id"],
            "api_key_id": api_key_data["id"],
            "scopes": api_key_data["scopes"],
            "rate_limit": api_key_data["rate_limit"]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"API key validation failed: {str(e)}"
        )


def generate_api_key() -> tuple[str, str, str]:
    api_key = secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    key_prefix = api_key[:8]
    return api_key, key_hash, key_prefix


def generate_webhook_secret() -> str:
    return secrets.token_urlsafe(32)
