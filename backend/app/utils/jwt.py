from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_async_session
from ..models.user import User


bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(subject: str) -> str:
    """Create a signed JWT for a user identifier."""

    return create_signed_token({"sub": subject}, expires_minutes=settings.access_token_expire_minutes)


def create_signed_token(payload: dict[str, Any], *, expires_minutes: int) -> str:
    """Create a signed JWT for arbitrary payload data."""

    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=expires_minutes)
    token_payload: dict[str, Any] = {**payload, "iat": issued_at, "exp": expires_at}
    return jwt.encode(token_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT."""

    return decode_signed_token(token)


def decode_signed_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT."""

    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        ) from exc


async def get_current_user(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> User:
    """Resolve the authenticated user from the bearer token."""

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )

    payload = decode_access_token(credentials.credentials)
    subject = payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    try:
        user_id = str(subject)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        ) from exc

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user was not found.",
        )
    return user
