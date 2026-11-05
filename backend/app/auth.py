"""Supabase access-token authentication and OAuth authorization for privileged backend routes."""

import os
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError, PyJWKClient, PyJWKClientConnectionError

bearer_scheme = HTTPBearer(auto_error=False)
ALLOWED_JWT_ALGORITHMS = {"ES256", "RS256"}


@dataclass(frozen=True)
class AdminPrincipal:
    user_id: str
    email: str | None = None
    auth_method: str = "token"


@lru_cache(maxsize=8)
def _jwks_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url, timeout=5, cache_keys=True)


def _get_trusted_issuers() -> dict[str, str]:
    """Map normalized project base URL to issuer URL."""
    candidates = [
        os.getenv("SUPABASE_URL"),
        os.getenv("VITE_SUPABASE_URL"),
        "https://tfayeekxlmxiuuyscrff.supabase.co",
        "https://dhjfrwpwedisxdxejktd.supabase.co",
    ]
    issuers = {}
    for c in candidates:
        if not c:
            continue
        clean = c.rstrip("/")
        if clean.endswith("/auth/v1"):
            iss = clean
            base = clean[:-8]
        else:
            base = clean
            iss = f"{clean}/auth/v1"
        issuers[base] = iss
        issuers[iss] = iss
    return issuers


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> AdminPrincipal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # 1. Dev token check strictly guarded by APP_ENV == "development"
    dev_token = os.getenv("DEV_ADMIN_TOKEN")
    app_env = os.getenv("APP_ENV", "production").strip().lower()
    if app_env == "development" and dev_token and token == dev_token:
        return AdminPrincipal(user_id="00000000-0000-0000-0000-000000000001", email="dev-admin@neravu.internal", auth_method="dev_token")

    # 2. Cryptographic JWT validation via Supabase JWKS
    trusted_map = _get_trusted_issuers()
    if not trusted_map:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin authentication is not configured",
        )

    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")
        if algorithm not in ALLOWED_JWT_ALGORITHMS:
            raise InvalidTokenError(f"Unsupported signing algorithm: {algorithm}")

        unverified_claims = jwt.decode(token, options={"verify_signature": False})
        claim_iss = unverified_claims.get("iss", "").rstrip("/")
        if not claim_iss or claim_iss not in trusted_map:
            raise InvalidTokenError("Untrusted token issuer")

        issuer = trusted_map[claim_iss]
        jwks_url = f"{issuer}/.well-known/jwks.json"
        signing_key = _jwks_client(jwks_url).get_signing_key_from_jwt(token)

        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=[algorithm],
            audience="authenticated",
            issuer=issuer,
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
    except PyJWKClientConnectionError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication provider unavailable",
        ) from error
    except (InvalidTokenError, ValueError, TypeError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired access token: {error}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    # 3. Role authorization check: app_metadata.role == 'admin' OR verified email in ADMIN_EMAILS
    app_metadata = claims.get("app_metadata") or {}
    user_email = claims.get("email") or ""
    admin_emails_env = os.getenv(
        "ADMIN_EMAILS",
        "optimizers64@gmail.com,reddisantosh772@gmail.com,chintamaneniharinisai@gmail.com",
    )
    admin_emails = {e.strip().lower() for e in admin_emails_env.split(",") if e.strip()}

    is_admin_role = isinstance(app_metadata, dict) and app_metadata.get("role") == "admin"
    is_admin_email = bool(user_email and user_email.lower() in admin_emails)

    if not (is_admin_role or is_admin_email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )

    user_id = claims.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AdminPrincipal(user_id=user_id, email=user_email, auth_method="supabase_jwt")
