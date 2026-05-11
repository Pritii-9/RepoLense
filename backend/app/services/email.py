from __future__ import annotations

import random
import string

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema

from ..config import settings
from ..utils.logger import get_logger


logger = get_logger(__name__)


def verification_email_enabled() -> bool:
    return bool(
        settings.mail_from_email
        and settings.mail_username
        and settings.mail_password
        and settings.mail_server
    )


def generate_verification_code(length: int = 6) -> str:
    """Generate a random 6-digit numeric verification code."""
    return "".join(random.choices(string.digits, k=length))


async def send_verification_email(
    email: str,
    full_name: str | None,
    code: str,
) -> None:
    """Send an OTP verification code email to the user."""

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
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f9fafb; border-radius: 12px;">
      <h2 style="color: #1e293b; font-size: 24px; font-weight: 700; margin-bottom: 8px;">Verify your RepoLens account</h2>
      <p style="color: #475569; margin-bottom: 24px;">Hello {recipient_name}, enter the verification code below in the app to complete your registration:</p>
      <div style="background: #4f46e5; color: white; font-size: 36px; font-weight: 800; letter-spacing: 12px; text-align: center; padding: 20px 24px; border-radius: 10px; margin-bottom: 24px;">
        {code}
      </div>
      <p style="color: #94a3b8; font-size: 13px;">This code expires in <strong>15 minutes</strong>. If you did not create a RepoLens account, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      <p style="color: #94a3b8; font-size: 12px;">RepoLens Team</p>
    </div>
    """

    message = MessageSchema(
        subject="Your RepoLens verification code",
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


async def send_password_reset_email(
    email: str,
    full_name: str | None,
    code: str,
) -> None:
    """Send an OTP code email for password reset."""

    if not verification_email_enabled():
        logger.info("password_reset_email_skipped", extra={"email": email})
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
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f9fafb; border-radius: 12px;">
      <h2 style="color: #1e293b; font-size: 24px; font-weight: 700; margin-bottom: 8px;">Reset your RepoLens password</h2>
      <p style="color: #475569; margin-bottom: 24px;">Hello {recipient_name}, enter the reset code below in the app to reset your password:</p>
      <div style="background: #e11d48; color: white; font-size: 36px; font-weight: 800; letter-spacing: 12px; text-align: center; padding: 20px 24px; border-radius: 10px; margin-bottom: 24px;">
        {code}
      </div>
      <p style="color: #94a3b8; font-size: 13px;">This code expires in <strong>15 minutes</strong>. If you did not request a password reset, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      <p style="color: #94a3b8; font-size: 12px;">RepoLens Team</p>
    </div>
    """

    message = MessageSchema(
        subject="Your RepoLens password reset code",
        recipients=[email],
        body=html_body,
        subtype="html",
    )

    fast_mail = FastMail(conf)
    try:
        await fast_mail.send_message(message)
        logger.info("password_reset_email_sent", extra={"email": email})
    except Exception:
        logger.exception("password_reset_email_failed", extra={"email": email})
