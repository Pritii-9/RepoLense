from __future__ import annotations

import uuid

from pydantic import BaseModel


class ReportDownloadURLResponse(BaseModel):
    report_id: uuid.UUID
    url: str
    expires_in_seconds: int = 3600
