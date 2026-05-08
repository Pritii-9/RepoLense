from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path


os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")
os.environ.setdefault("S3_BUCKET_NAME", "test-bucket")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException

from app.utils.jwt import create_access_token, decode_access_token
from app.utils.password import hash_password, verify_password


class PasswordUtilsTests(unittest.TestCase):
    def test_hash_password_creates_a_different_value_and_can_be_verified(self) -> None:
        raw_password = "Password123"

        password_hash = hash_password(raw_password)

        self.assertNotEqual(password_hash, raw_password)
        self.assertTrue(verify_password(raw_password, password_hash))
        self.assertFalse(verify_password("WrongPassword123", password_hash))


class JwtUtilsTests(unittest.TestCase):
    def test_create_access_token_round_trips_the_user_id(self) -> None:
        token = create_access_token("user-123")

        payload = decode_access_token(token)

        self.assertEqual(payload["sub"], "user-123")
        self.assertIn("exp", payload)

    def test_decode_access_token_rejects_invalid_tokens(self) -> None:
        with self.assertRaises(HTTPException) as exc:
            decode_access_token("not-a-real-token")

        self.assertEqual(exc.exception.status_code, 401)
        self.assertEqual(exc.exception.detail, "Invalid authentication token.")
