from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str | None
    is_verified: bool
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RegistrationResponse(BaseModel):
    message: str
    verification_required: bool = True


class VerifyCodeRequest(BaseModel):
    """OTP verification: user submits their email + the 6-digit code."""
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class ResendRequest(BaseModel):
    """Resend OTP: only email is needed (no password required)."""
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    """Request password reset code."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Reset password using the code."""
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)


class SimpleResponse(BaseModel):
    message: str
