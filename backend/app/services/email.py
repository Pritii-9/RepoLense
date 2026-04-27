from __future__ import annotations

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

from ..config import settings
from ..utils.jwt import create_access_token


def verification_email_enabled() -> bool:
    return bool(
        settings.mail_from_email
        and settings.mail_username
        and settings.mail_password
        and settings.mail_server
    )


def build_verification_url(user_id: str) -> str:
    verify_token = create_access_token(user_id)
    return f"{settings.frontend_base_url.rstrip('/')}/auth?token={verify_token}"


async def send_verification_email(
    user_id: str,
    email: str,
    full_name: str | None,
    token_expire_minutes: int = 15 * 60,  # 15 minutes
) -> None:
    """Send email verification email to user."""

    verification_url = build_verification_url(user_id)

    if not verification_email_enabled():
        print(f"Email config missing, skipping send to {email}")
        return

    conf = ConnectionConfig(
        MAIL_USERNAME=settings.mail_username,
        MAIL_PASSWORD=settings.mail_password,
        MAIL_FROM=settings.mail_from_email,
        MAIL_PORT=settings.mail_port,
        MAIL_SERVER=settings.mail_server,
        MAIL_FROM_NAME=settings.mail_from_name,
        MAIL_STARTTLS=settings.mail_use_tls,
        MAIL_SSL_TLS=settings.mail_use_ssl,
        USE_CREDENTIALS=True,
        TEMPLATE_FOLDER=None,
    )
    
    message = MessageSchema(
        subject="Verify your RepoLens account",
        recipients=[email],
        template_body={
            "url": verification_url,
            "name": full_name or email.split("@")[0],
        },
        subtype=MessageType.HTML,
        html_body="""
        <h2>Verify your RepoLens account</h2>
        <p>Hello {{name}},</p>
        <p>Thank you for registering with RepoLens. Please verify your email by clicking the link below:</p>
        <a href="{{url}}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Verify Email</a>
        <p>This link expires in 15 minutes.</p>
        <p>If you didn't create an account, ignore this email.</p>
        <hr>
        <p><small>RepoLens Team</small></p>
        """,
    )
    
    fast_mail = FastMail(conf)
    await fast_mail.send_message(message)


async def send_resend_verification_email(session: AsyncSession, user: User) -> None:
    """Send resend verification email."""
    await send_verification_email(str(user.id), user.email, user.full_name)

