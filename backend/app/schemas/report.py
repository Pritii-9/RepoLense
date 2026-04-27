from __future__ import annotations

import uuid

from typing import Literal
from pydantic import BaseModel


class ReportDownloadURLResponse(BaseModel):
    report_id: str
    url: str
    expires_in_seconds: int = 3600


class ExportRequest(BaseModel):
    format: Literal["csv", "json"]


class ExportResponse(BaseModel):
    download_url: str
    filename: str
    expires_in_seconds: int = 3600
