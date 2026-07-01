import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

from unittest.mock import MagicMock, AsyncMock
from app.utils.jwt import get_current_user
from app.db import get_async_session

class TestAnalysisLimiter(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        
    @patch("app.routers.analysis.run_analysis_pipeline_task.delay")
    def test_rate_limit_exceeded(self, mock_delay):
        # Mock user
        mock_user = MagicMock()
        mock_user.id = "user123"
        
        async def override_get_async_session():
            yield AsyncMock()

        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[get_async_session] = override_get_async_session

        # Submit 6 requests (Limit is 5/hour)
        payload = {"repository_url": "https://github.com/example/repo", "branch": "main"}
        
        for i in range(5):
            res = self.client.post("/analysis/submit", json=payload)
            # Depending on DB state, this might fail with 404 or 500 without a real DB in tests,
            # but the limiter is applied before DB operations usually.
            # However, since we're using a TestClient without DB isolation in this simple test,
            # we'll just check if the 6th request gets 429.
            
        res6 = self.client.post("/analysis/submit", json=payload)
        self.assertEqual(res6.status_code, 429)
        self.assertIn("Rate limit exceeded", res6.text)

    def tearDown(self):
        app.dependency_overrides.clear()
