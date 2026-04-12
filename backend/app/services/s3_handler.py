from __future__ import annotations

import boto3

from app.config import settings


class S3Handler:
    """Thin wrapper around boto3 for report uploads and signed downloads."""

    def __init__(self) -> None:
        self._client = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
        )

    def upload_bytes(self, content: bytes, key: str, content_type: str) -> None:
        self._client.put_object(
            Bucket=settings.s3_bucket_name,
            Key=key,
            Body=content,
            ContentType=content_type,
        )

    def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket_name, "Key": key},
            ExpiresIn=expires_in,
        )


s3_handler = S3Handler()
