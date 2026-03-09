import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.hashers import check_password, make_password
from django.test import TestCase, override_settings

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.db.utils import DatabaseError
from django.utils import timezone
from rest_framework.test import APITestCase

from .exceptions import UnauthorizedError
from .models import RefreshToken, User
from .serializers import (
    PASSWORD_RULES_MESSAGE,
    PHONE_RULES_MESSAGE,
    RegisterRequestSerializer,
)
from .services import (
    authenticate_user_and_issue_tokens,
    create_user_from_register_payload,
    get_jwks_payload,
    logout_with_refresh_token,
    refresh_access_token,
)


def _generate_test_private_key_pem() -> str:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")


class JwtSettingsMixin:
    def setUp(self):
        super().setUp()
        self._settings_override = override_settings(
            USERS_JWT_PRIVATE_KEY=_generate_test_private_key_pem(),
            USERS_JWT_KID="test-key-1",
            USERS_JWT_ISSUER="itcommerce-users",
            USERS_JWT_AUDIENCE="itcommerce-api",
            USERS_JWT_ACCESS_TTL_SECONDS=900,
            USERS_JWT_REFRESH_TTL_SECONDS=604800,
            USERS_ROTATE_REFRESH_TOKENS=True,
        )
        self._settings_override.enable()

    def tearDown(self):
        self._settings_override.disable()
        super().tearDown()


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


class LoginServiceUnitTests(JwtSettingsMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create(
            email="john@example.com",
            password_hash=make_password("StrongPassword123!"),
            first_name="John",
            last_name="Doe",
            role="USER",
        )

    def test_login_success_creates_refresh_token_and_expected_claims(self):
        response = authenticate_user_and_issue_tokens("john@example.com", "StrongPassword123!")

        self.assertIn("accessToken", response)
        self.assertIn("refreshToken", response)
        self.assertEqual(response["expiresIn"], 900)
        self.assertEqual(RefreshToken.objects.count(), 1)
        refresh = RefreshToken.objects.get()
        self.assertEqual(refresh.user_id, self.user.id)
        self.assertFalse(refresh.revoked)
        self.assertIsNotNone(refresh.expires_at)

        jwks = get_jwks_payload()
        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwks["keys"][0]))
        claims = jwt.decode(
            response["accessToken"],
            key=public_key,
            algorithms=["RS256"],
            audience="itcommerce-api",
            issuer="itcommerce-users",
        )
        self.assertEqual(claims["sub"], str(self.user.id))
        self.assertEqual(claims["email"], self.user.email)
        self.assertEqual(claims["roles"], ["USER"])
        self.assertIn("iat", claims)
        self.assertIn("exp", claims)
        self.assertIn("jti", claims)

    def test_login_fails_with_wrong_password(self):
        with self.assertRaisesMessage(UnauthorizedError, "Invalid email or password."):
            authenticate_user_and_issue_tokens("john@example.com", "WrongPassword1!")

    def test_jwks_contains_expected_rsa_fields(self):
        jwks = get_jwks_payload()

        self.assertIn("keys", jwks)
        self.assertEqual(len(jwks["keys"]), 1)
        key = jwks["keys"][0]
        self.assertEqual(key["kty"], "RSA")
        self.assertEqual(key["kid"], "test-key-1")
        self.assertEqual(key["use"], "sig")
        self.assertEqual(key["alg"], "RS256")
        self.assertIn("n", key)
        self.assertIn("e", key)


class RefreshLogoutServiceUnitTests(JwtSettingsMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create(
            email="john@example.com",
            password_hash=make_password("StrongPassword123!"),
            first_name="John",
            last_name="Doe",
            role="USER",
        )

    def _create_active_refresh_token(self) -> RefreshToken:
        login_payload = authenticate_user_and_issue_tokens("john@example.com", "StrongPassword123!")
        return RefreshToken.objects.get(token=login_payload["refreshToken"])

    def test_refresh_happy_path_rotates_refresh_token(self):
        old_token = self._create_active_refresh_token()

        response = refresh_access_token(old_token.token)

        self.assertIn("accessToken", response)
        self.assertIn("expiresIn", response)
        self.assertIn("refreshToken", response)
        self.assertNotEqual(response["refreshToken"], old_token.token)

        old_token.refresh_from_db()
        self.assertTrue(old_token.revoked)

        new_token = RefreshToken.objects.get(token=response["refreshToken"])
        self.assertFalse(new_token.revoked)
        self.assertEqual(new_token.user_id, self.user.id)

    def test_refresh_revoked_token_fails(self):
        token = self._create_active_refresh_token()
        token.revoked = True
        token.save(update_fields=["revoked"])

        with self.assertRaisesMessage(UnauthorizedError, "Refresh token has been revoked."):
            refresh_access_token(token.token)

    def test_refresh_expired_token_fails(self):
        token = self._create_active_refresh_token()
        token.expires_at = timezone.now() - timedelta(seconds=1)
        token.save(update_fields=["expires_at"])

        with self.assertRaisesMessage(UnauthorizedError, "Refresh token has expired."):
            refresh_access_token(token.token)

    def test_logout_revokes_refresh_token(self):
        token = self._create_active_refresh_token()

        response = logout_with_refresh_token(token.token)

        self.assertEqual(response["message"], "Logged out successfully.")
        token.refresh_from_db()
        self.assertTrue(token.revoked)

    def test_logout_nonexistent_token_fails(self):
        with self.assertRaisesMessage(UnauthorizedError, "Invalid refresh token."):
            logout_with_refresh_token("does-not-exist")


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


class LoginEndpointIntegrationTests(JwtSettingsMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create(
            email="john@example.com",
            password_hash=make_password("StrongPassword123!"),
            first_name="John",
            last_name="Doe",
            role="USER",
        )

    def test_login_success_returns_tokens_and_persists_refresh(self):
        payload = {"email": "john@example.com", "password": "StrongPassword123!"}

        response = self.client.post("/api/v1/users/login", data=payload, format="json")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("accessToken", data)
        self.assertIn("refreshToken", data)
        self.assertEqual(data["expiresIn"], 900)
        self.assertEqual(RefreshToken.objects.count(), 1)
        refresh = RefreshToken.objects.get(token=data["refreshToken"])
        self.assertEqual(refresh.user_id, self.user.id)
        self.assertFalse(refresh.revoked)

    def test_login_fails_with_wrong_password(self):
        payload = {"email": "john@example.com", "password": "WrongPassword1!"}

        response = self.client.post("/api/v1/users/login", data=payload, format="json")

        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertEqual(data["status"], 401)
        self.assertEqual(data["error"], "UNAUTHORIZED")
        self.assertEqual(data["path"], "/api/v1/users/login")
        self.assertIn("timestamp", data)

    def test_access_token_signature_verifies_against_jwks(self):
        login_response = self.client.post(
            "/api/v1/users/login",
            data={"email": "john@example.com", "password": "StrongPassword123!"},
            format="json",
        )
        self.assertEqual(login_response.status_code, 200)
        access_token = login_response.json()["accessToken"]

        jwks_response = self.client.get("/.well-known/jwks.json")
        self.assertEqual(jwks_response.status_code, 200)
        jwks = jwks_response.json()
        self.assertIn("keys", jwks)
        self.assertEqual(len(jwks["keys"]), 1)
        self.assertEqual(jwks["keys"][0]["kid"], "test-key-1")

        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwks["keys"][0]))
        claims = jwt.decode(
            access_token,
            key=public_key,
            algorithms=["RS256"],
            audience="itcommerce-api",
            issuer="itcommerce-users",
        )
        self.assertEqual(claims["sub"], str(self.user.id))
        self.assertEqual(claims["email"], "john@example.com")
        self.assertEqual(claims["roles"], ["USER"])
        self.assertIn("jti", claims)

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


class RefreshLogoutEndpointIntegrationTests(JwtSettingsMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create(
            email="john@example.com",
            password_hash=make_password("StrongPassword123!"),
            first_name="John",
            last_name="Doe",
            role="USER",
        )

    def _login_and_get_refresh_token(self) -> str:
        response = self.client.post(
            "/api/v1/users/login",
            data={"email": "john@example.com", "password": "StrongPassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        return response.json()["refreshToken"]

    def test_refresh_happy_path_rotates_token(self):
        old_token = self._login_and_get_refresh_token()

        response = self.client.post(
            "/api/v1/users/refresh",
            data={"refreshToken": old_token},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("accessToken", data)
        self.assertEqual(data["expiresIn"], 900)
        self.assertIn("refreshToken", data)
        self.assertNotEqual(data["refreshToken"], old_token)

        old_token_row = RefreshToken.objects.get(token=old_token)
        self.assertTrue(old_token_row.revoked)
        new_token_row = RefreshToken.objects.get(token=data["refreshToken"])
        self.assertFalse(new_token_row.revoked)

    def test_refresh_revoked_token_returns_401(self):
        token = self._login_and_get_refresh_token()
        token_row = RefreshToken.objects.get(token=token)
        token_row.revoked = True
        token_row.save(update_fields=["revoked"])

        response = self.client.post(
            "/api/v1/users/refresh",
            data={"refreshToken": token},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertEqual(data["status"], 401)
        self.assertEqual(data["error"], "UNAUTHORIZED")
        self.assertEqual(data["path"], "/api/v1/users/refresh")

    def test_refresh_expired_token_returns_401(self):
        token = self._login_and_get_refresh_token()
        token_row = RefreshToken.objects.get(token=token)
        token_row.expires_at = timezone.now() - timedelta(seconds=1)
        token_row.save(update_fields=["expires_at"])

        response = self.client.post(
            "/api/v1/users/refresh",
            data={"refreshToken": token},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertEqual(data["status"], 401)
        self.assertEqual(data["error"], "UNAUTHORIZED")
        self.assertEqual(data["path"], "/api/v1/users/refresh")

    def test_logout_success_revokes_token(self):
        token = self._login_and_get_refresh_token()

        response = self.client.post(
            "/api/v1/users/logout",
            data={"refreshToken": token},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["message"], "Logged out successfully.")

        token_row = RefreshToken.objects.get(token=token)
        self.assertTrue(token_row.revoked)

    def test_logout_revoked_token_returns_401(self):
        token = self._login_and_get_refresh_token()
        token_row = RefreshToken.objects.get(token=token)
        token_row.revoked = True
        token_row.save(update_fields=["revoked"])

        response = self.client.post(
            "/api/v1/users/logout",
            data={"refreshToken": token},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertEqual(data["status"], 401)
        self.assertEqual(data["error"], "UNAUTHORIZED")
        self.assertEqual(data["path"], "/api/v1/users/logout")

    def test_logout_expired_token_returns_401(self):
        token = self._login_and_get_refresh_token()
        token_row = RefreshToken.objects.get(token=token)
        token_row.expires_at = timezone.now() - timedelta(seconds=1)
        token_row.save(update_fields=["expires_at"])

        response = self.client.post(
            "/api/v1/users/logout",
            data={"refreshToken": token},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertEqual(data["status"], 401)
        self.assertEqual(data["error"], "UNAUTHORIZED")
        self.assertEqual(data["path"], "/api/v1/users/logout")
