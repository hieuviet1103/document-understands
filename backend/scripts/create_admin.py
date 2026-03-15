#!/usr/bin/env python3
"""
Create first admin user (Supabase Auth + organization + user_profiles).
Uses only httpx + dotenv (no supabase package) to avoid realtime/pydantic conflicts.

User is created with email_confirm=True so you can log in immediately.

Usage:
    python scripts/create_admin.py
    python scripts/create_admin.py --email you@example.com --password "YourPass!" --name "Admin"
    python scripts/create_admin.py --email existing@example.com --password "x" --name "Admin" --update-only
"""

import argparse
import os
import sys
from typing import Optional

# Allow run from backend/ or project root
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

_env_path = os.path.join(_BACKEND_DIR, ".env")
if os.path.isfile(_env_path):
    from dotenv import load_dotenv
    load_dotenv(_env_path)

try:
    import httpx
except ImportError:
    print("ERROR: Install httpx: pip install httpx")
    sys.exit(1)


DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001"
DEFAULT_ORG_NAME = "Default Organization"
DEFAULT_ORG_SLUG = "default"
DEFAULT_EMAIL = "admin@example.com"
DEFAULT_PASS = "Admin@123456"
DEFAULT_NAME = "System Admin"
DEFAULT_LANG = "en"


def _auth_headers(service_role_key: str) -> dict:
    return {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": "application/json",
    }


def _rest_headers(service_role_key: str) -> dict:
    return {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _get_user_id_by_email(base_url: str, service_role_key: str, email: str) -> Optional[str]:
    """Get Auth user id by email (list users)."""
    url = f"{base_url.rstrip('/')}/auth/v1/admin/users"
    with httpx.Client(timeout=30) as client:
        r = client.get(url, headers=_auth_headers(service_role_key), params={"per_page": 1000})
    if r.status_code != 200:
        return None
    data = r.json()
    for u in data.get("users") or []:
        if u.get("email") == email:
            return u.get("id")
    return None


def create_admin(
    email: str,
    password: str,
    display_name: str,
    language: str = "en",
    org_name: Optional[str] = None,
    org_slug: Optional[str] = None,
    update_only: bool = False,
) -> None:
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not service_role_key:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env")
        sys.exit(1)

    org_name = org_name or DEFAULT_ORG_NAME
    org_slug = org_slug or DEFAULT_ORG_SLUG
    lang = language if language in ("en", "vi") else "en"

    with httpx.Client(timeout=30) as client:
        auth_h = _auth_headers(service_role_key)
        rest_h = _rest_headers(service_role_key)

        # 1. Ensure default organization exists
        rest_base = f"{base_url}/rest/v1"
        r = client.get(
            f"{rest_base}/organizations",
            headers={**rest_h, "Accept": "application/json"},
            params={"id": f"eq.{DEFAULT_ORG_ID}", "select": "id"},
        )
        if r.status_code != 200:
            print(f"ERROR: organizations request failed: {r.status_code} {r.text[:200]}")
            sys.exit(1)
        existing_orgs = r.json() if r.text else []
        if not existing_orgs:
            r2 = client.post(
                f"{rest_base}/organizations",
                headers=rest_h,
                json={"id": DEFAULT_ORG_ID, "name": org_name, "slug": org_slug},
            )
            if r2.status_code not in (200, 201):
                print(f"ERROR: create organization: {r2.status_code} {r2.text[:200]}")
                sys.exit(1)
            print("OK Created default organization")
        else:
            print("OK Default organization already exists")

        user_id = None

        if update_only:
            user_id = _get_user_id_by_email(base_url, service_role_key, email)
            if not user_id:
                print("ERROR: No Auth user with this email. Remove --update-only or create user first.")
                sys.exit(1)
            print(f"OK Found Auth user — id: {user_id}")
        else:
            # 2. Create Auth user (email_confirm=True)
            auth_url = f"{base_url}/auth/v1/admin/users"
            body = {"email": email, "password": password, "email_confirm": True}
            r = client.post(auth_url, headers=auth_h, json=body)
            if r.status_code in (200, 201):
                j = r.json()
                user_id = j.get("id") or (j.get("user") or {}).get("id")
                print(f"OK Auth user created — id: {user_id}")
            else:
                err_text = (r.text or "").lower()
                if "already" in err_text or "registered" in err_text or "exists" in err_text:
                    user_id = _get_user_id_by_email(base_url, service_role_key, email)
                    if user_id:
                        print(f"OK Auth user already exists — id: {user_id}")
                    else:
                        print(f"ERROR: User exists but could not get id: {r.text[:200]}")
                        sys.exit(1)
                else:
                    print(f"ERROR creating Auth user: {r.status_code} {r.text[:200]}")
                    sys.exit(1)

        # 3. Create or update user_profiles
        profile_payload = {
            "organization_id": DEFAULT_ORG_ID,
            "role": "admin",
            "display_name": display_name,
            "language": lang,
            "settings": {},
        }
        r = client.get(
            f"{rest_base}/user_profiles",
            headers={**rest_h, "Accept": "application/json"},
            params={"id": f"eq.{user_id}", "select": "id"},
        )
        if r.status_code != 200:
            print(f"ERROR: user_profiles get: {r.status_code} {r.text[:200]}")
            sys.exit(1)
        profiles = r.json() if r.text else []
        if profiles:
            r2 = client.patch(
                f"{rest_base}/user_profiles",
                headers=rest_h,
                params={"id": f"eq.{user_id}"},
                json=profile_payload,
            )
            if r2.status_code not in (200, 204):
                print(f"ERROR: profile update: {r2.status_code} {r2.text[:200]}")
                sys.exit(1)
            print("OK Profile updated -> role=admin, organization_id set")
        else:
            r2 = client.post(
                f"{rest_base}/user_profiles",
                headers=rest_h,
                json={"id": user_id, **profile_payload},
            )
            if r2.status_code not in (200, 201):
                err = r2.text or ""
                if "PGRST204" in err or "schema cache" in err or "display_name" in err:
                    print("ERROR: user_profiles table is missing column 'display_name'.")
                    print("Run this in Supabase Dashboard -> SQL Editor, then run this script again:")
                    print("  ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '';")
                    print("  ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';")
                else:
                    print(f"ERROR: profile insert: {r2.status_code} {r2.text[:200]}")
                sys.exit(1)
            print("OK Profile created with role=admin")

    print()
    print("=" * 50)
    print("  Admin account ready")
    print("=" * 50)
    print(f"  Email    : {email}")
    print(f"  Password : {password}")
    print(f"  Name     : {display_name}")
    print(f"  Role     : admin")
    print(f"  Org      : {org_name}")
    print("=" * 50)
    print("  Log in at /login (no email confirmation needed).")
    print("  Change password after first login.")
    print("=" * 50)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create admin user (Supabase Auth + org + profile)")
    parser.add_argument("--email", default=DEFAULT_EMAIL, help=f"Login email (default: {DEFAULT_EMAIL})")
    parser.add_argument("--password", default=DEFAULT_PASS, help="Password")
    parser.add_argument("--name", default=DEFAULT_NAME, help=f"Display name (default: {DEFAULT_NAME})")
    parser.add_argument("--language", default=DEFAULT_LANG, choices=("en", "vi"), help="Language en/vi")
    parser.add_argument("--org-name", default=None, help="Organization name")
    parser.add_argument("--org-slug", default=None, help="Organization slug")
    parser.add_argument("--update-only", action="store_true", help="Only update profile (user must exist)")
    args = parser.parse_args()

    create_admin(
        email=args.email,
        password=args.password,
        display_name=args.name,
        language=args.language,
        org_name=args.org_name,
        org_slug=args.org_slug,
        update_only=args.update_only,
    )
