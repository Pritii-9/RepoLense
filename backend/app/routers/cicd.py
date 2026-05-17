from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_async_session
from ..models.user import User
from ..schemas.analysis import PRRiskRequest, PRRiskResponse
from ..services.llm_client import LLMClient
from ..services.prompts import PR_RISK_ANALYSIS_PROMPT
from ..utils.jwt import get_current_user
from ..utils.logger import get_logger

router = APIRouter(prefix="/cicd", tags=["cicd"])
logger = get_logger(__name__)


@router.post(
    "/pr-risk",
    response_model=PRRiskResponse,
    status_code=status.HTTP_200_OK,
)
async def predict_pr_risk(
    payload: PRRiskRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> PRRiskResponse:
    """
    Analyze a Pull Request diff and return a structured risk assessment.
    Used for CI/CD integrations.
    """
    llm_client = LLMClient()
    try:
        messages = [
            {
                "role": "user",
                "content": PR_RISK_ANALYSIS_PROMPT.format(
                    repo_url=payload.repository_url,
                    branch=payload.branch,
                    diff_text=payload.diff_text,
                ),
            }
        ]

        logger.info(
            "Starting PR risk analysis",
            extra={"repo": payload.repository_url, "branch": payload.branch, "user_id": str(current_user.id)}
        )

        result, metrics = await llm_client.generate_structured(messages, PRRiskResponse)
        
        logger.info(
            "PR risk analysis completed",
            extra={
                "risk_score": result.risk_score,
                "risk_level": result.risk_level,
                "latency_ms": metrics.latency_ms,
            }
        )

        return result

    except Exception as exc:
        logger.exception("Failed to analyze PR risk", extra={"error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Analysis failed: {exc}",
        ) from exc
    finally:
        await llm_client.close()
