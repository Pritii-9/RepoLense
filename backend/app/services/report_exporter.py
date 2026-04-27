from __future__ import annotations

import asyncio
import csv
import json
import io
import uuid
from datetime import datetime, timezone
from typing import Dict, Any

from ..services.s3_handler import s3_handler
from ..utils.logger import get_logger

logger = get_logger(__name__)


async def generate_code_metric_export(
    metric_data: Dict[str, Any], 
    analysis_id: str, 
    format_type: str = 'csv'
) -> str:
    """Generate export data for code metrics and upload to S3. Returns S3 key."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    
    if format_type.lower() == 'csv':
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=list(metric_data.keys()))
        writer.writeheader()
        writer.writerow(metric_data)
        content = buffer.getvalue().encode('utf-8')
        content_type = 'text/csv'
        file_name = f"code_metrics_{analysis_id}_{timestamp}.csv"
    elif format_type.lower() == 'json':
        content = json.dumps(metric_data, indent=2).encode('utf-8')
        content_type = 'application/json'
        file_name = f"code_metrics_{analysis_id}_{timestamp}.json"
    else:
        raise ValueError("Unsupported format. Use 'csv' or 'json'.")

    s3_key = f"exports/{str(uuid.uuid4())}/{file_name}"
    await asyncio.to_thread(s3_handler.upload_bytes, content, s3_key, content_type)
    logger.info("export_generated", extra={"analysis_id": analysis_id, "format": format_type, "s3_key": s3_key})
    return s3_key


async def get_presigned_export_url(s3_key: str) -> str:
    return await asyncio.to_thread(s3_handler.generate_presigned_url, s3_key, 3600)

