"""Supabase Auth JWT verification for protected API routes."""

from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.config import settings

_bearer = HTTPBearer(auto_error=False)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


def _issuer() -> str:
    return f"{settings.supabase_url.rstrip('/')}/auth/v1"


@lru_cache
def _jwks_client() -> PyJWKClient:
    return PyJWKClient(f"{_issuer()}/.well-known/jwks.json", cache_keys=True)


def decode_token(token: str) -> dict[str, Any]:
    """Verify signature, expiry, audience and issuer; return the claims."""
    if settings.supabase_jwt_secret:
        key: Any = settings.supabase_jwt_secret
        algorithms = ["HS256"]
    else:
        key = _jwks_client().get_signing_key_from_jwt(token).key
        algorithms = ["RS256", "ES256", "EdDSA"]
    return jwt.decode(
        token,
        key,
        algorithms=algorithms,
        audience="authenticated",
        issuer=_issuer(),
        options={"require": ["exp", "sub"]},
    )


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> dict[str, Any]:
    if credentials is None:
        raise _UNAUTHORIZED
    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth is not configured (SUPABASE_URL is unset)",
        )
    try:
        return decode_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise _UNAUTHORIZED from exc


CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]
