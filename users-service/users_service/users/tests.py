from unittest.mock import patch

from django.db.utils import DatabaseError
from rest_framework.test import APITestCase


class HealthEndpointTests(APITestCase):
    def test_health_success(self):
        response = self.client.get("/api/v1/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "UP"})

    @patch("users.views.connection.cursor", side_effect=DatabaseError("db down"))
    def test_health_db_failure_returns_standard_error_shape(self, _mock_cursor):
        response = self.client.get("/api/v1/health")

        self.assertEqual(response.status_code, 500)
        payload = response.json()
        self.assertEqual(payload["status"], 500)
        self.assertEqual(payload["error"], "INTERNAL_ERROR")
        self.assertEqual(payload["path"], "/api/v1/health")
        self.assertIn("Database connectivity check failed.", payload["message"])
        self.assertIn("timestamp", payload)


class ApiErrorNormalizationTests(APITestCase):
    def test_unknown_api_path_returns_standard_not_found_shape(self):
        response = self.client.get("/api/v1/does-not-exist")

        self.assertEqual(response.status_code, 404)
        payload = response.json()
        self.assertEqual(payload["status"], 404)
        self.assertEqual(payload["error"], "RESOURCE_NOT_FOUND")
        self.assertEqual(payload["path"], "/api/v1/does-not-exist")
        self.assertEqual(payload["message"], "Resource not found.")
        self.assertIn("timestamp", payload)
