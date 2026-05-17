import secrets
from typing import Annotated
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_async_session
from ..models.user import User
from ..utils.jwt import create_access_token
from ..utils.password import hash_password
from ..utils.logger import get_logger

router = APIRouter(prefix="/auth/github", tags=["github_auth"])
logger = get_logger(__name__)


@router.get("/login")
async def github_login():
    """Redirect to GitHub OAuth authorization page."""
    if not settings.github_client_id:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="GitHub OAuth is not configured on the server."
        )

    params = {
        "client_id": settings.github_client_id,
        "scope": "user:email",
        # We redirect to the callback handled by the backend
    }
    url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    return RedirectResponse(url)


@router.get("/callback")
async def github_callback(
    code: str,
    session: Annotated[AsyncSession, Depends(get_async_session)]
):
    """Handle callback from GitHub OAuth."""
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="GitHub OAuth is not configured on the server."
        )

    # 1. Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
            },
        )
        token_data = token_res.json()
        
        if "error" in token_data:
            logger.error("github_oauth_error", extra={"error": token_data})
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to authenticate with GitHub."
            )
            
        access_token = token_data.get("access_token")

        # 2. Get user emails
        emails_res = await client.get(
            "https://api.github.com/user/emails",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json",
            }
        )
        emails = emails_res.json()

        # Also fetch the user's profile name
        profile_res = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json",
            }
        )
        profile_data = profile_res.json()
        github_name = profile_data.get("name") or profile_data.get("login") or "GitHub User"

    # Find primary and verified email
    primary_email = None
    for email_obj in emails:
        if email_obj.get("primary") and email_obj.get("verified"):
            primary_email = email_obj.get("email")
            break
            
    if not primary_email:
        # Fallback to any verified email
        for email_obj in emails:
            if email_obj.get("verified"):
                primary_email = email_obj.get("email")
                break

    if not primary_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verified email found on your GitHub account."
        )

    # 3. Find or create user
    primary_email = primary_email.lower()
    result = await session.execute(select(User).where(User.email == primary_email))
    user = result.scalar_one_or_none()

    if not user:
        # Create a new user with a random unguessable password
        random_password = secrets.token_urlsafe(32)
        user = User(
            email=primary_email,
            full_name=github_name,
            password_hash=hash_password(random_password),
            is_verified=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    else:
        # Update name from GitHub if it was a placeholder
        if user.full_name in (None, "GitHub User"):
            user.full_name = github_name
        if not user.is_verified:
            user.is_verified = True
        await session.commit()

    # 4. Generate JWT token
    jwt_token = create_access_token(str(user.id))

    # 5. Redirect to frontend with token
    # Example: http://localhost:4173/oauth-callback?token=xxx
    redirect_url = f"{settings.frontend_base_url}/oauth-callback?token={jwt_token}"
    return RedirectResponse(redirect_url)
