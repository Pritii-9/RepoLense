from __future__ import annotations

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Application user."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_verified: Mapped[bool] = mapped_column(default=False, index=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(nullable=True)
    # OTP-based email verification
    verification_code: Mapped[str | None] = mapped_column(String(6), nullable=True)
    verification_code_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Password reset fields
    reset_password_code: Mapped[str | None] = mapped_column(String(6), nullable=True)
    reset_password_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    analyses = relationship(
        "Analysis",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
