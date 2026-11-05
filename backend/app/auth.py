"""Supabase access-token authentication for privileged backend routes."""

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


@lru_cache(maxsize=4)
def _jwks_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url, timeout=5, cache_keys=True)


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> AdminPrincipal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    if not supabase_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin authentication is not configured",
        )

    issuer = f"{supabase_url}/auth/v1"
    jwks_url = f"{issuer}/.well-known/jwks.json"
    token = credentials.credentials

    # Optional local development token (strictly active only when APP_ENV == "development")
    dev_token = os.getenv("DEV_ADMIN_TOKEN")
    app_env = os.getenv("APP_ENV", "production").strip().lower()
    if app_env == "development" and dev_token and token == dev_token:
        return AdminPrincipal(user_id="00000000-0000-0000-0000-000000000001")

    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")
        if algorithm not in ALLOWED_JWT_ALGORITHMS:
            raise InvalidTokenError("Unsupported signing algorithm")

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
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    app_metadata = claims.get("app_metadata")
    if not isinstance(app_metadata, dict) or app_metadata.get("role") != "admin":
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

    return AdminPrincipal(user_id=user_id)
