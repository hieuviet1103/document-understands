from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
from app.core.supabase import get_supabase_client, get_supabase_admin_client
from app.models.schemas import UserRole
import hashlib
import secrets


security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    token = credentials.credentials
    supabase = get_supabase_client()

    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )

        user_id = user_response.user.id

        profile_response = supabase.table("user_profiles").select("*").eq("id", user_id).maybeSingle().execute()

        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )

        return {
            "user_id": user_id,
            "email": user_response.user.email,
            "profile": profile_response.data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )


async def require_role(required_roles: list[UserRole]):
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
        api_key_response = supabase.table("api_keys").select("*, user_profiles(*)").eq("key_hash", key_hash).eq("is_active", True).maybeSingle().execute()

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
