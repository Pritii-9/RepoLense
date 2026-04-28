from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_async_session
from ..models.user import User
from ..schemas.auth import (
    RegistrationResponse,
    ResendRequest,
    SimpleResponse,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    VerifyRequest,
)
from ..services.email import (
    build_verification_url,
    send_verification_email,
    verification_email_enabled,
)
from ..utils.jwt import create_access_token, decode_access_token
from ..utils.password import hash_password, verify_password
from ..utils.logger import get_logger


router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)


@router.post(
    "/register",
    response_model=RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_user(
    payload: UserRegisterRequest,
    background_tasks: BackgroundTasks,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> RegistrationResponse:
    logger.info("register_user_attempt", extra={"email": payload.email})
    existing_user = await session.execute(
        select(User).where(User.email == payload.email.lower())
    )
    if existing_user.scalar_one_or_none() is not None:
        logger.warning("register_user_email_exists", extra={"email": payload.email})
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
    )
    session.add(user)
    try:
        await session.commit()
        logger.info("register_user_created", extra={"user_id": str(user.id), "email": user.email})
    except IntegrityError as exc:
        await session.rollback()
        logger.error("register_user_integrity_error", extra={"error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc

    await session.refresh(user)

    verification_url = build_verification_url(str(user.id))
    if verification_email_enabled():
        background_tasks.add_task(
            send_verification_email,
            str(user.id),
            user.email,
            user.full_name,
        )

    return RegistrationResponse(
        message="Account created. Please verify your email before logging in.",
        verification_url=verification_url,
    )


@router.post("/login", response_model=TokenResponse)
async def login_user(
    payload: UserLoginRequest,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> TokenResponse:
    result = await session.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in.",
        )

    access_token = create_access_token(str(user.id))
    return TokenResponse(access_token=access_token, user=user)


@router.post("/verify", response_model=SimpleResponse)
async def verify_email(
    payload: VerifyRequest,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> SimpleResponse:
    jwt_payload = decode_access_token(payload.token)
    user_id = str(jwt_payload["sub"])

    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user.is_verified:
        return SimpleResponse(message="Email already verified.")

    user.is_verified = True
    user.email_verified_at = datetime.now(tz=timezone.utc)
    await session.commit()

    return SimpleResponse(message="Email verified successfully.")


@router.post("/resend-verification", response_model=SimpleResponse)
async def resend_verification(
    payload: ResendRequest,
    background_tasks: BackgroundTasks,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> SimpleResponse:
    result = await session.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified.",
        )

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password.",
        )

    verification_url = build_verification_url(str(user.id))
    if verification_email_enabled():
        background_tasks.add_task(
            send_verification_email,
            str(user.id),
            user.email,
            user.full_name,
        )

    return SimpleResponse(
        message="Verification email sent.",
        verification_url=verification_url,
    )
