from __future__ import annotations

from pathlib import Path

import boto3

from ..config import settings
from ..utils.logger import get_logger


logger = get_logger(__name__)


def _is_placeholder(value: str | None) -> bool:
    normalized = (value or "").strip().lower()
    return not normalized or normalized == "dummy"


class S3Handler:
    """Storage wrapper with an S3 backend and a local filesystem fallback."""

    def __init__(self) -> None:
        self._use_local_storage = any(
            [
                _is_placeholder(settings.aws_access_key_id),
                _is_placeholder(settings.aws_secret_access_key),
                _is_placeholder(settings.s3_bucket_name),
            ]
        )
        self._storage_root = settings.object_storage_directory
        self._storage_root.mkdir(parents=True, exist_ok=True)
        self._client = None

        if not self._use_local_storage:
            self._client = boto3.client(
                "s3",
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                region_name=settings.aws_region,
            )

    @property
    def use_local_storage(self) -> bool:
        return self._use_local_storage

    def _local_path(self, key: str) -> Path:
        safe_key = key.replace("\\", "/").lstrip("/")
        return self._storage_root / Path(safe_key)

    def upload_bytes(self, content: bytes, key: str, content_type: str) -> None:
        destination = self._local_path(key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)

        if self._use_local_storage:
            return

        try:
            assert self._client is not None
            self._client.put_object(
                Bucket=settings.s3_bucket_name,
                Key=key,
                Body=content,
                ContentType=content_type,
            )
        except Exception:
            logger.exception("object_storage_upload_failed", extra={"key": key})

    def download_bytes(self, key: str) -> bytes:
        local_path = self._local_path(key)
        if local_path.exists():
            return local_path.read_bytes()

        if self._use_local_storage:
            raise FileNotFoundError(f"Stored object not found for key '{key}'.")

        assert self._client is not None
        response = self._client.get_object(Bucket=settings.s3_bucket_name, Key=key)
        return response["Body"].read()

    def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        if self._use_local_storage:
            return self._local_path(key).resolve().as_uri()

        assert self._client is not None
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket_name, "Key": key},
            ExpiresIn=expires_in,
        )


s3_handler = S3Handler()
