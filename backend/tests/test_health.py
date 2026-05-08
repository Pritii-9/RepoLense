from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

from fastapi import HTTPException
from fastapi.testclient import TestClient


os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")
os.environ.setdefault("S3_BUCKET_NAME", "test-bucket")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app, get_async_session


class HealthRouteTests(unittest.TestCase):
    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_health_returns_ok_when_database_query_succeeds(self) -> None:
        class HealthySession:
            async def execute(self, _query):
                return 1

        async def override_get_async_session():
            yield HealthySession()

        app.dependency_overrides[get_async_session] = override_get_async_session

        with TestClient(app) as client:
            response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_health_keeps_request_id_in_error_response(self) -> None:
        async def override_get_async_session():
            raise HTTPException(status_code=503, detail="Database connection unavailable.")
            yield

        app.dependency_overrides[get_async_session] = override_get_async_session

        with TestClient(app) as client:
            response = client.get("/health", headers={"X-Request-ID": "req-123"})

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "Database connection unavailable.")
        self.assertEqual(response.json()["request_id"], "req-123")
