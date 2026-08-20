from __future__ import annotations

import asyncio
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from jose import JWTError

from ..config import settings
from ..services.ws_manager import ws_manager
from ..utils.logger import get_logger
from ..utils.jwt import get_current_user
from ..models.user import User

logger = get_logger(__name__)

router = APIRouter(prefix="/analysis", tags=["logs"])


@router.get("/{analysis_id}/logs/history")
async def get_analysis_logs_history(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Retrieve the in-memory log history for an analysis."""
    return ws_manager.get_history(analysis_id)



@router.websocket("/{analysis_id}/logs")
async def analysis_logs(
    websocket: WebSocket,
    analysis_id: str,
    token: str | None = Query(default=None),
) -> None:
    """WebSocket endpoint that streams live analysis log events.

    Authentication: pass the JWT as a `?token=` query parameter because
    browsers cannot set custom HTTP headers during the WebSocket upgrade.
    The connection is kept alive until the client disconnects or the
    pipeline emits a terminal event (type='done' or type='error').
    """
    if not token:
        token = websocket.query_params.get("token")

    logger.info(
        "ws_connection_attempt",
        extra={"analysis_id": analysis_id, "has_token": bool(token)},
    )

    # --- Auth check ---
    if not token:
        logger.warning(
            "ws_auth_missing",
            extra={"analysis_id": analysis_id},
        )
        await websocket.accept()
        await asyncio.sleep(0.1)
        await websocket.close(code=4001, reason="Missing authentication token.")
        return

    try:
        from jose import jwt as jose_jwt
        payload = jose_jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        if not payload.get("sub"):
            raise JWTError("no sub")
    except JWTError as exc:
        logger.warning(
            "ws_auth_failed",
            extra={"analysis_id": analysis_id, "error": str(exc)},
        )
        await websocket.accept()
        await asyncio.sleep(0.1)
        await websocket.close(code=4001, reason="Invalid authentication token.")
        return

    # --- Connect and wait ---
    await ws_manager.connect(analysis_id, websocket)
    try:
        # Block until the client disconnects or the server closes the socket.
        # We don't need to receive messages – this is a one-way log stream.
        while True:
            # Await a client message just to detect disconnection.
            # A timeout allows the loop to run even if no message arrives.
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    except Exception:
        pass
    finally:
        ws_manager.disconnect(analysis_id, websocket)
