from __future__ import annotations

import json
import tempfile
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    project_name: str = "RepoLens API"
    environment: str = "development"
    database_url: str = Field(alias="DATABASE_URL")
    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    aws_access_key_id: str = Field(alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str = Field(alias="AWS_SECRET_ACCESS_KEY")
    aws_region: str = "us-east-1"
    s3_bucket_name: str = Field(alias="S3_BUCKET_NAME")
    github_token: str | None = Field(default=None, alias="GITHUB_TOKEN")
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
        alias="CORS_ORIGINS",
    )
    temp_directory: Path = Path(tempfile.gettempdir()) / "repolens"
    clone_timeout_seconds: int = 180
    duplicate_window_lines: int = 6
    hotspot_limit: int = 20
    max_file_size_bytes: int = 1_000_000

    @field_validator("temp_directory", mode="before")
    @classmethod
    def _coerce_path(cls, value: object) -> Path:
        return Path(str(value))

    @property
    def sqlalchemy_database_url(self) -> str:
        """Return a SQLAlchemy async-compatible database URL."""

        if self.database_url.startswith("postgres://"):
            return self.database_url.replace("postgres://", "postgresql+asyncpg://", 1)
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace(
                "postgresql://",
                "postgresql+asyncpg://",
                1,
            )
        return self.database_url

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS origins as a list."""

        raw_value = self.cors_origins.strip()
        if not raw_value:
            return []
        if raw_value.startswith("["):
            loaded = json.loads(raw_value)
            if isinstance(loaded, list):
                return [str(item).strip() for item in loaded if str(item).strip()]
        return [item.strip() for item in raw_value.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
