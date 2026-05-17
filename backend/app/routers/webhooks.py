import secrets
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_async_session
from ..models.analysis import Analysis
from ..models.user import User
from ..tasks import run_analysis_pipeline
from ..utils.logger import get_logger
from ..utils.password import hash_password

router = APIRouter(prefix="/webhooks/github", tags=["webhooks"])
logger = get_logger(__name__)


@router.post("")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Handle incoming GitHub webhooks (e.g., push or pull_request events)."""
    
    # In a real app, you would verify the X-Hub-Signature-256 header here
    # to ensure the payload actually came from GitHub using your webhook secret.
    
    # 1. Parse Payload
    event = request.headers.get("X-GitHub-Event", "ping")
    payload = await request.json()
    
    if event == "ping":
        return {"status": "ok", "message": "Pong!"}

    if event != "pull_request":
        logger.info("webhook_ignored", extra={"event": event})
        return {"status": "ignored", "message": "Only pull_request events are handled."}
        
    action = payload.get("action")
    if action not in ("opened", "synchronize", "reopened"):
        logger.info("webhook_ignored", extra={"action": action})
        return {"status": "ignored", "message": "Ignored PR action."}

    # Extract repository and branch info
    repository = payload.get("repository", {})
    repo_url = repository.get("html_url")
    repo_name = repository.get("name")
    
    pull_request = payload.get("pull_request", {})
    branch = pull_request.get("head", {}).get("ref")
    
    if not repo_url or not repo_name or not branch:
        return {"status": "error", "message": "Missing repository or branch information."}

    # 2. Find or Create a System User to own the Analysis
    # In a production system, you'd link the webhook to a specific organization or user account.
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

    # 3. Create the Analysis Record
    analysis = Analysis(
        user_id=str(user.id),
        repository_url=repo_url,
        repository_name=repo_name,
        branch=branch,
    )
    session.add(analysis)
    await session.commit()
    await session.refresh(analysis)
    
    logger.info("webhook_analysis_queued", extra={"analysis_id": str(analysis.id), "repo": repo_name})

    # 4. Trigger the Background Task
    background_tasks.add_task(
        run_analysis_pipeline,
        str(analysis.id),
    )

    return {"status": "accepted", "analysis_id": str(analysis.id)}
