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
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_async_session
from app.main import app
from app.models import Base
from app.models.user import User

class ForgotPasswordTests(unittest.TestCase):
    def setUp(self) -> None:
        self.test_data_dir = Path(__file__).resolve().parents[1] / ".tmp" / "test-data"
        self.test_data_dir.mkdir(parents=True, exist_ok=True)
        database_path = self.test_data_dir / "forgot-password.db"
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
        
        # Create a test user
        asyncio.run(self._create_test_user())

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.client.close()
        asyncio.run(self.engine.dispose())
        if self.database_path.exists():
            self.database_path.unlink()

    async def _create_tables(self) -> None:
        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    async def _create_test_user(self) -> None:
        from app.routers.auth_fixed import hash_password
        async with self.session_factory() as session:
            user = User(
                email="test@example.com",
                full_name="Test User",
                password_hash=hash_password("OldPassword123"),
                is_verified=True
            )
            session.add(user)
            await session.commit()

    async def _get_user(self, email: str) -> User | None:
        async with self.session_factory() as session:
            result = await session.execute(select(User).where(User.email == email.lower()))
            return result.scalar_one_or_none()

    def test_forgot_password_success(self) -> None:
        with patch("app.routers.auth_fixed.send_password_reset_email") as mock_send:
            response = self.client.post(
                "/auth/forgot-password",
                json={"email": "test@example.com"},
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["message"], "If that email is registered, we have sent a code.")
            mock_send.assert_called_once()

    def test_reset_password_success(self) -> None:
        # First generate a code
        with patch("app.routers.auth_fixed.send_password_reset_email"):
            self.client.post("/auth/forgot-password", json={"email": "test@example.com"})
            
        # Get the code from DB
        user = asyncio.run(self._get_user("test@example.com"))
        self.assertIsNotNone(user.reset_password_code)
        
        # Now reset
        response = self.client.post(
            "/auth/reset-password",
            json={
                "email": "test@example.com",
                "code": user.reset_password_code,
                "new_password": "NewPassword123"
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "Password reset successfully.")
        
        # Try login with new password
        login_response = self.client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "NewPassword123"},
        )
        self.assertEqual(login_response.status_code, 200)

    def test_reset_password_wrong_code(self) -> None:
        with patch("app.routers.auth_fixed.send_password_reset_email"):
            self.client.post("/auth/forgot-password", json={"email": "test@example.com"})
            
        response = self.client.post(
            "/auth/reset-password",
            json={
                "email": "test@example.com",
                "code": "000000", # Wrong code
                "new_password": "NewPassword123"
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Invalid or expired reset code.")
