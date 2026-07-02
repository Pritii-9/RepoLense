"""GitHub Webhook Router

Handles incoming GitHub webhook events.

Key improvements over the original:
  - HMAC-SHA256 signature verification (X-Hub-Signature-256)
  - A manual /trigger-review endpoint so you can demo the bot without a live webhook
  - Clean separation of PR-review-only vs full-analysis dispatch
  - Proper 400/403 responses for invalid payloads
"""
from __future__ import annotations

import hashlib
import hmac
import secrets

from fastapi import APIRouter, BackgroundTasks, Body, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from ..config import settings
from ..db import get_async_session
from ..models.analysis import Analysis
from ..models.user import User
from ..tasks import run_analysis_pipeline_task, run_pr_review_task_wrapper
from ..utils.jwt import get_current_user
from ..utils.logger import get_logger
from ..utils.password import hash_password

router = APIRouter(prefix="/webhooks/github", tags=["webhooks"])
logger = get_logger(__name__)

# ── Signature verification ────────────────────────────────────────────────────

WEBHOOK_SECRET: str | None = getattr(settings, "github_webhook_secret", None)


def _verify_signature(body: bytes, sig_header: str | None) -> bool:
    """Verify the X-Hub-Signature-256 header from GitHub.

    Returns True if the secret is not configured (dev mode) or if the
    signature matches. Returns False if the signature is wrong.
    """
    if not WEBHOOK_SECRET:
        # Not configured — skip verification (useful for local dev)
        logger.warning("webhook_signature_verification_skipped_no_secret")
        return True

    if not sig_header or not sig_header.startswith("sha256="):
        return False

    expected = hmac.new(
        WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", sig_header)


# ── System user helper ────────────────────────────────────────────────────────

async def _get_or_create_webhook_user(session: AsyncSession) -> User:
    """Return the internal webhook service user, creating it if absent."""
    system_email = "system-webhook@repolens.dev"
    result = await session.execute(select(User).where(User.email == system_email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=system_email,
            full_name="GitHub Webhook Service",
            password_hash=hash_password(secrets.token_urlsafe(32)),
            is_verified=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    return user


# ── Webhook endpoint ──────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_200_OK)
async def github_webhook(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    x_hub_signature_256: Annotated[str | None, Header()] = None,
    x_github_event: Annotated[str, Header()] = "ping",
):
    """Handle incoming GitHub webhook events.

    Supported events:
    - ``ping``        → health check response
    - ``pull_request`` (opened / synchronize / reopened)
                     → trigger AI code review + full analysis
    """
    body = await request.body()

    if not _verify_signature(body, x_hub_signature_256):
        logger.warning("webhook_invalid_signature")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid webhook signature.")

    if x_github_event == "ping":
        return {"status": "ok", "message": "Pong! RepoLense webhook is active."}

    if x_github_event != "pull_request":
        logger.info("webhook_event_ignored", extra={"event": x_github_event})
        return {"status": "ignored", "message": f"Event '{x_github_event}' is not handled."}

    payload = await request.json()
    action = payload.get("action")
    if action not in ("opened", "synchronize", "reopened"):
        return {"status": "ignored", "message": f"PR action '{action}' not handled."}

    repository = payload.get("repository", {})
    repo_owner = repository.get("owner", {}).get("login")
    repo_url = repository.get("html_url")
    repo_name = repository.get("name")

    pull_request = payload.get("pull_request", {})
    pull_number = pull_request.get("number")
    branch = pull_request.get("head", {}).get("ref")
    pr_title = pull_request.get("title", "Untitled PR")

    if not all([repo_url, repo_name, branch, repo_owner, pull_number]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required fields in webhook payload.",
        )

    user = await _get_or_create_webhook_user(session)

    analysis = Analysis(
        user_id=str(user.id),
        repository_url=repo_url,
        repository_name=repo_name,
        branch=branch,
    )
    session.add(analysis)
    await session.commit()
    await session.refresh(analysis)

    logger.info(
        "webhook_tasks_queued",
        extra={
            "analysis_id": str(analysis.id),
            "repo": f"{repo_owner}/{repo_name}",
            "pr": pull_number,
            "pr_title": pr_title,
        },
    )

    # Dispatch both tasks asynchronously
    run_analysis_pipeline_task.delay(str(analysis.id))
    run_pr_review_task_wrapper.delay(repo_owner, repo_name, pull_number)

    return {
        "status": "accepted",
        "analysis_id": str(analysis.id),
        "pr": pull_number,
        "message": f"AI review queued for PR #{pull_number}: {pr_title}",
    }


# ── Manual trigger endpoint ───────────────────────────────────────────────────

class ManualReviewRequest(BaseModel):
    repo_owner: str
    repo_name: str
    pr_number: int


@router.post(
    "/trigger-review",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Manually trigger an AI PR review (demo / testing)",
)
async def trigger_manual_review(
    payload: ManualReviewRequest = Body(...),
    current_user: User = Depends(get_current_user),
):
    """Manually queue an AI code review for any public GitHub PR.

    Useful for demoing the PR reviewer bot without needing a live webhook.
    Requires authentication.
    """
    if not settings.github_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub token is not configured. Cannot fetch PR diff.",
        )

    logger.info(
        "manual_pr_review_triggered",
        extra={
            "user_id": str(current_user.id),
            "repo": f"{payload.repo_owner}/{payload.repo_name}",
            "pr": payload.pr_number,
        },
    )

    run_pr_review_task_wrapper.delay(
        payload.repo_owner, payload.repo_name, payload.pr_number
    )

    return {
        "status": "accepted",
        "message": (
            f"AI review queued for {payload.repo_owner}/{payload.repo_name}#{payload.pr_number}. "
            "The bot will post a comment on the PR within ~30 seconds."
        ),
    }
