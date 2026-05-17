from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_async_session
from ..models.user import User
from ..schemas.auth import (
    ForgotPasswordRequest,
    RegistrationResponse,
    ResendRequest,
    ResetPasswordRequest,
    SimpleResponse,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    VerifyCodeRequest,
    UserResponse,
    UpdateProfileRequest,
)
from ..services.email import (
    generate_verification_code,
    send_password_reset_email,
    send_verification_email,
    verification_email_enabled,
)
from ..utils.jwt import create_access_token, get_current_user
from ..utils.password import hash_password, verify_password
from ..utils.logger import get_logger


router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)

# OTP expiry duration
OTP_EXPIRE_MINUTES = 15


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
    result = await session.execute(
        select(User).where(User.email == payload.email.lower())
    )
    existing_user = result.scalar_one_or_none()

    # If the account exists and is already verified, reject with 409
    if existing_user is not None and existing_user.is_verified:
        logger.warning("register_user_email_exists_verified", extra={"email": payload.email})
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # Generate a fresh OTP
    code = generate_verification_code()
    expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)

    if existing_user is not None:
        # Unverified account — update credentials + OTP so the user can retry
        logger.info(
            "register_user_reissue_otp_for_unverified",
            extra={"email": payload.email},
        )
        existing_user.full_name = payload.full_name
        existing_user.password_hash = hash_password(payload.password)
        existing_user.verification_code = code
        existing_user.verification_code_expires_at = expires_at
        existing_user.is_verified = True
        await session.commit()
        await session.refresh(existing_user)
        user = existing_user
    else:
        user = User(
            email=payload.email.lower(),
            full_name=payload.full_name,
            password_hash=hash_password(payload.password),
            verification_code=code,
            verification_code_expires_at=expires_at,
            is_verified=True,
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

    if verification_email_enabled():
        background_tasks.add_task(
            send_verification_email,
            user.email,
            user.full_name,
            code,
        )
    else:
        # Dev mode: log the code so it can be used without email
        logger.info("verification_code_dev", extra={"email": user.email, "code": code})

    return RegistrationResponse(
        message="Account created. Please check your email for a 6-digit verification code.",
        verification_required=True,
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


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """Get the currently authenticated user's profile."""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateProfileRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> UserResponse:
    """Update display name and/or set a password for the logged-in user."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip() or None
    if payload.new_password is not None:
        current_user.password_hash = hash_password(payload.new_password)
    await session.merge(current_user)
    await session.commit()
    await session.refresh(current_user)
    return current_user


@router.delete("/me", status_code=204)
async def delete_me(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> None:
    """Permanently delete the logged-in user's account."""
    user = await session.get(User, current_user.id)
    if user:
        await session.delete(user)
        await session.commit()
    logger.info("account_deleted", extra={"user_id": str(current_user.id)})


@router.post("/verify", response_model=SimpleResponse)
async def verify_email(
    payload: VerifyCodeRequest,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> SimpleResponse:
    """Verify email using the 6-digit OTP code sent to the user's email."""
    result = await session.execute(
        select(User).where(User.email == payload.email.lower())
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user.is_verified:
        return SimpleResponse(message="Email already verified.")

    if not user.verification_code or user.verification_code != payload.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code.",
        )

    now = datetime.now(tz=timezone.utc)
    if user.verification_code_expires_at:
        # SQLite returns naive datetimes — compare consistently
        exp = user.verification_code_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has expired. Please request a new one.",
            )

    user.is_verified = True
    user.email_verified_at = now
    user.verification_code = None
    user.verification_code_expires_at = None
    await session.commit()

    return SimpleResponse(message="Email verified successfully.")


@router.post("/resend-verification", response_model=SimpleResponse)
async def resend_verification(
    payload: ResendRequest,
    background_tasks: BackgroundTasks,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> SimpleResponse:
    """Resend a new 6-digit OTP code to the user's email."""
    result = await session.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified.",
        )

    # Issue a fresh OTP
    code = generate_verification_code()
    expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)
    user.verification_code = code
    user.verification_code_expires_at = expires_at
    await session.commit()

    if verification_email_enabled():
        background_tasks.add_task(
            send_verification_email,
            user.email,
            user.full_name,
            code,
        )
    else:
        logger.info("verification_code_dev_resend", extra={"email": user.email, "code": code})

    return SimpleResponse(message="A new verification code has been sent to your email.")


@router.post("/forgot-password", response_model=SimpleResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> SimpleResponse:
    """Request a password reset code."""
    result = await session.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()

    if not user:
        # To prevent user enumeration, we still return a success message
        return SimpleResponse(message="If that email is registered, we have sent a code.")

    # Issue a fresh OTP for password reset
    code = generate_verification_code()
    expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)
    user.reset_password_code = code
    user.reset_password_expires_at = expires_at
    await session.commit()

    if verification_email_enabled():
        background_tasks.add_task(
            send_password_reset_email,
            user.email,
            user.full_name,
            code,
        )
    else:
        logger.info("forgot_password_code_dev", extra={"email": user.email, "code": code})

    return SimpleResponse(message="If that email is registered, we have sent a code.")


@router.post("/reset-password", response_model=SimpleResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> SimpleResponse:
    """Reset password using the code."""
    result = await session.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if not user.reset_password_code or user.reset_password_code != payload.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset code.",
        )

    now = datetime.now(tz=timezone.utc)
    if user.reset_password_expires_at:
        exp = user.reset_password_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reset code has expired. Please request a new one.",
            )

    user.password_hash = hash_password(payload.new_password)
    user.reset_password_code = None
    user.reset_password_expires_at = None
    await session.commit()

    return SimpleResponse(message="Password reset successfully.")
