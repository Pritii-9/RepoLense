from __future__ import annotations

import asyncio
from collections import defaultdict

from fastapi import WebSocket

from ..utils.logger import get_logger

logger = get_logger(__name__)


class WebSocketManager:
    """Manages active WebSocket connections grouped by analysis_id.

    This is a simple in-memory manager suitable for single-process deployments.
    All operations are asyncio-safe (no threading).
    """

    def __init__(self) -> None:
        # analysis_id -> list of connected WebSocket clients
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, analysis_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[analysis_id].append(websocket)
        logger.info(
            "ws_client_connected",
            extra={"analysis_id": analysis_id, "total": len(self._connections[analysis_id])},
        )

    def disconnect(self, analysis_id: str, websocket: WebSocket) -> None:
        conns = self._connections.get(analysis_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._connections.pop(analysis_id, None)
        logger.info(
            "ws_client_disconnected",
            extra={"analysis_id": analysis_id, "remaining": len(conns)},
        )

    async def broadcast(self, analysis_id: str, payload: dict) -> None:
        """Send a JSON payload to all clients subscribed to this analysis."""
        conns = list(self._connections.get(analysis_id, []))
        if not conns:
            return

        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.disconnect(analysis_id, ws)


# Module-level singleton – import this everywhere you need to emit events.
ws_manager = WebSocketManager()
