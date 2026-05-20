from __future__ import annotations

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError

from ..config import settings
from ..services.ws_manager import ws_manager
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/analysis", tags=["logs"])


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
    # --- Auth check ---
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token.")
        return

    try:
        from jose import jwt as jose_jwt
        payload = jose_jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        if not payload.get("sub"):
            raise JWTError("no sub")
    except JWTError:
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
