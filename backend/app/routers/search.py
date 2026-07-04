from __future__ import annotations

import math
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_async_session
from ..models.analysis import Analysis
from ..models.enums import AnalysisStatus
from ..models.user import User
from ..services.vector_store import VectorStoreService
from ..utils.jwt import get_current_user
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/analysis", tags=["search"])


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    k: int = Field(default=6, ge=1, le=20)


class SearchResult(BaseModel):
    file_path: str
    snippet: str
    score: float  # 0.0 (worst) – 1.0 (best)


class SearchResponse(BaseModel):
    results: list[SearchResult]
    query: str
    total: int


def _l2_to_similarity(l2_distance: float) -> float:
    """Convert a ChromaDB L2 distance to a 0-1 similarity score.

    ChromaDB returns squared Euclidean distances for the default
    'l2' metric.  A distance of 0 means identical vectors (score=1).
    We apply a simple exponential decay so the result is always in [0, 1].
    """
    return round(math.exp(-l2_distance), 4)


@router.post(
    "/{analysis_id}/search",
    response_model=SearchResponse,
    status_code=status.HTTP_200_OK,
)
async def semantic_search(
    analysis_id: str,
    payload: SearchRequest,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SearchResponse:
    """Run a semantic similarity search over the indexed repository codebase.

    Only available for analyses with status='completed' that belong to the
    authenticated user.
    """
    result = await session.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Semantic search is only available for completed analyses (current status: '{analysis.status}').",
        )

    vs = VectorStoreService(analysis_id)
    try:
        embeddings = vs._get_embeddings()
        raw = vs._get_vectorstore(embeddings).similarity_search_with_score(
            payload.query, k=payload.k
        )
    except Exception as exc:
        logger.exception("semantic_search_failed", extra={"analysis_id": analysis_id})
        raise HTTPException(
            status_code=500,
            detail="Search index is not available. The repository may not have been indexed yet.",
        ) from exc

    results: list[SearchResult] = []
    for doc, distance in raw:
        results.append(
            SearchResult(
                file_path=doc.metadata.get("source", "unknown"),
                snippet=doc.page_content[:600],  # cap to keep payload small
                score=_l2_to_similarity(distance),
            )
        )

    # Sort best-first
    results.sort(key=lambda r: r.score, reverse=True)

    logger.info(
        "semantic_search_completed",
        extra={"analysis_id": analysis_id, "query": payload.query[:80], "hits": len(results)},
    )
    return SearchResponse(results=results, query=payload.query, total=len(results))
