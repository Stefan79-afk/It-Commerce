from django.contrib.auth.hashers import check_password
from django.test import TestCase
from unittest.mock import patch

from django.db.utils import DatabaseError
from rest_framework.test import APITestCase

from .models import User
from .serializers import (
    PASSWORD_RULES_MESSAGE,
    PHONE_RULES_MESSAGE,
    RegisterRequestSerializer,
)
from .services import create_user_from_register_payload


class RegisterValidationUnitTests(TestCase):
    def test_register_serializer_accepts_valid_payload(self):
        serializer = RegisterRequestSerializer(
            data={
                "email": "  JOHN@example.COM ",
                "password": "StrongPassword123!",
                "firstName": " John ",
                "lastName": " Doe ",
                "phoneNumber": "+40123456789",
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["email"], "john@example.com")
        self.assertEqual(serializer.validated_data["firstName"], "John")
        self.assertEqual(serializer.validated_data["lastName"], "Doe")

    def test_register_serializer_requires_fields(self):
        serializer = RegisterRequestSerializer(data={})

        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)
        self.assertIn("password", serializer.errors)
        self.assertIn("firstName", serializer.errors)
        self.assertIn("lastName", serializer.errors)

    def test_register_serializer_rejects_invalid_email(self):
        serializer = RegisterRequestSerializer(
            data={
                "email": "not-an-email",
                "password": "StrongPassword123!",
                "firstName": "John",
                "lastName": "Doe",
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

    def test_register_serializer_rejects_weak_passwords(self):
        weak_passwords = [
            "short1!",
            "lowercase123!",
            "UPPERCASE123!",
            "NoDigits!!",
            "NoSpecial123",
        ]

        for password in weak_passwords:
            serializer = RegisterRequestSerializer(
                data={
                    "email": "john@example.com",
                    "password": password,
                    "firstName": "John",
                    "lastName": "Doe",
                }
            )

            self.assertFalse(serializer.is_valid())
            self.assertIn("password", serializer.errors)
            self.assertEqual(serializer.errors["password"][0], PASSWORD_RULES_MESSAGE)

    def test_register_serializer_rejects_invalid_phone_number(self):
        invalid_phone_numbers = [
            "40123456789",
            "+0123456789",
            "+40 1234 56789",
            "+40-1234-56789",
            "+40(123)456789",
            "+40abc123456",
            "+4012",
        ]

        for phone in invalid_phone_numbers:
            serializer = RegisterRequestSerializer(
                data={
                    "email": "john@example.com",
                    "password": "StrongPassword123!",
                    "firstName": "John",
                    "lastName": "Doe",
                    "phoneNumber": phone,
                }
            )

            self.assertFalse(serializer.is_valid())
            self.assertIn("phoneNumber", serializer.errors)
            self.assertEqual(serializer.errors["phoneNumber"][0], PHONE_RULES_MESSAGE)


class RegisterModelCreationUnitTests(TestCase):
    def test_register_service_creates_user_and_hashes_password(self):
        serializer = RegisterRequestSerializer(
            data={
                "email": "john@example.com",
                "password": "StrongPassword123!",
                "firstName": "John",
                "lastName": "Doe",
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

        user = create_user_from_register_payload(serializer.validated_data)

        self.assertEqual(User.objects.count(), 1)
        db_user = User.objects.get(id=user.id)
        self.assertEqual(db_user.email, "john@example.com")
        self.assertEqual(db_user.first_name, "John")
        self.assertEqual(db_user.last_name, "Doe")
        self.assertNotEqual(db_user.password_hash, "StrongPassword123!")
        self.assertTrue(check_password("StrongPassword123!", db_user.password_hash))


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


class RegisterEndpointIntegrationTests(APITestCase):
    def test_register_success_returns_201_payload(self):
        payload = {
            "email": "john@example.com",
            "password": "StrongPassword123!",
            "firstName": "John",
            "lastName": "Doe",
            "phoneNumber": "+40123456789",
        }

        response = self.client.post("/api/v1/users/register", data=payload, format="json")

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["email"], "john@example.com")
        self.assertEqual(data["firstName"], "John")
        self.assertEqual(data["lastName"], "Doe")
        self.assertEqual(data["phoneNumber"], "+40123456789")
        self.assertIn("id", data)
        self.assertIn("createdAt", data)
        self.assertNotIn("updatedAt", data)

        user = User.objects.get(email="john@example.com")
        self.assertTrue(check_password(payload["password"], user.password_hash))

    def test_register_duplicate_email_returns_409_error_shape(self):
        User.objects.create(
            email="john@example.com",
            password_hash="hash",
            first_name="John",
            last_name="Doe",
        )
        payload = {
            "email": "JOHN@example.com",
            "password": "StrongPassword123!",
            "firstName": "John",
            "lastName": "Doe",
        }

        response = self.client.post("/api/v1/users/register", data=payload, format="json")

        self.assertEqual(response.status_code, 409)
        data = response.json()
        self.assertEqual(data["status"], 409)
        self.assertEqual(data["error"], "CONFLICT")
        self.assertEqual(data["path"], "/api/v1/users/register")
        self.assertIn("timestamp", data)

    def test_register_invalid_payload_returns_400_error_shape(self):
        payload = {
            "email": "invalid-email",
            "password": "weak",
            "firstName": "John",
            "lastName": "Doe",
        }

        response = self.client.post("/api/v1/users/register", data=payload, format="json")

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data["status"], 400)
        self.assertEqual(data["error"], "VALIDATION_ERROR")
        self.assertEqual(data["path"], "/api/v1/users/register")
        self.assertIn("timestamp", data)

    def test_register_invalid_phone_number_returns_400_error_shape(self):
        payload = {
            "email": "john@example.com",
            "password": "StrongPassword123!",
            "firstName": "John",
            "lastName": "Doe",
            "phoneNumber": "12345",
        }

        response = self.client.post("/api/v1/users/register", data=payload, format="json")

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data["status"], 400)
        self.assertEqual(data["error"], "VALIDATION_ERROR")
        self.assertEqual(data["path"], "/api/v1/users/register")
        self.assertIn("timestamp", data)
