from __future__ import annotations

import asyncio
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")
os.environ.setdefault("S3_BUCKET_NAME", "test-bucket")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_async_session
from app.main import app
from app.models import Base
from app.models.user import User


class AuthFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.test_data_dir = Path(__file__).resolve().parents[1] / ".tmp" / "test-data"
        self.test_data_dir.mkdir(parents=True, exist_ok=True)
        database_path = self.test_data_dir / "auth-flow.db"
        if database_path.exists():
            database_path.unlink()
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{database_path.as_posix()}")
        self.session_factory = async_sessionmaker(self.engine, expire_on_commit=False)
        self.database_path = database_path
        asyncio.run(self._create_tables())

        async def override_get_async_session():
            async with self.session_factory() as session:
                yield session

        app.dependency_overrides[get_async_session] = override_get_async_session
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.client.close()
        asyncio.run(self.engine.dispose())
        if self.database_path.exists():
            self.database_path.unlink()

    async def _create_tables(self) -> None:
        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    async def _get_user(self, email: str) -> User | None:
        async with self.session_factory() as session:
            result = await session.execute(select(User).where(User.email == email.lower()))
            return result.scalar_one_or_none()

    def test_register_verify_and_login_flow(self) -> None:
        with (
            patch("app.routers.auth_fixed.generate_verification_code", return_value="123456"),
            patch("app.routers.auth_fixed.verification_email_enabled", return_value=False),
        ):
            register_response = self.client.post(
                "/auth/register",
                json={
                    "email": "candidate@example.com",
                    "password": "Password123",
                    "full_name": "Entry Level Dev",
                },
            )

        self.assertEqual(register_response.status_code, 201)
        self.assertEqual(
            register_response.json()["message"],
            "Account created. Please check your email for a 6-digit verification code.",
        )

        login_response = self.client.post(
            "/auth/login",
            json={"email": "candidate@example.com", "password": "Password123"},
        )
        self.assertEqual(login_response.status_code, 200)
        body = login_response.json()
        self.assertEqual(body["token_type"], "bearer")
        self.assertEqual(body["user"]["email"], "candidate@example.com")
        self.assertTrue(body["access_token"])

        user = asyncio.run(self._get_user("candidate@example.com"))
        self.assertIsNotNone(user)
        self.assertTrue(user.is_verified)

    def test_resend_verification_requires_existing_unverified_user(self) -> None:
        missing_user_response = self.client.post(
            "/auth/resend-verification",
            json={"email": "missing@example.com"},
        )

        self.assertEqual(missing_user_response.status_code, 404)
        self.assertEqual(missing_user_response.json()["detail"], "User not found.")
