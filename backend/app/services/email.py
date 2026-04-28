from __future__ import annotations

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema

from ..config import settings
from ..utils.jwt import create_access_token
from ..utils.logger import get_logger


logger = get_logger(__name__)


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
    token_expire_minutes: int = 15 * 60,
) -> None:
    """Send email verification email to user."""

    del token_expire_minutes

    verification_url = build_verification_url(user_id)

    if not verification_email_enabled():
        logger.info("verification_email_skipped", extra={"email": email})
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

    recipient_name = full_name or email.split("@")[0]
    html_body = f"""
    <h2>Verify your RepoLens account</h2>
    <p>Hello {recipient_name},</p>
    <p>Thank you for registering with RepoLens. Please verify your email by clicking the link below:</p>
    <p><a href="{verification_url}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Verify Email</a></p>
    <p>If you did not create an account, you can ignore this email.</p>
    <hr>
    <p><small>RepoLens Team</small></p>
    """

    message = MessageSchema(
        subject="Verify your RepoLens account",
        recipients=[email],
        body=html_body,
        subtype="html",
    )

    fast_mail = FastMail(conf)
    try:
        await fast_mail.send_message(message)
        logger.info("verification_email_sent", extra={"email": email})
    except Exception:
        logger.exception("verification_email_failed", extra={"email": email})

