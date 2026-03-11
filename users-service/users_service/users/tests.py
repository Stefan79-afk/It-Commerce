import json
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.hashers import check_password, make_password
from django.conf import settings
from django.test import TestCase, override_settings

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.db.utils import DatabaseError
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework.exceptions import NotFound

from .exceptions import UnauthorizedError
from .models import Address, RefreshToken, User
from .serializers import (
    PASSWORD_RULES_MESSAGE,
    PasswordResetRequestSerializer,
    PHONE_RULES_MESSAGE,
    RegisterRequestSerializer,
)
from .services import (
    authenticate_user_and_issue_tokens,
    create_user_from_register_payload,
    get_jwks_payload,
    logout_with_refresh_token,
    reset_user_password,
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


class PasswordResetValidationUnitTests(TestCase):
    def test_password_reset_serializer_accepts_valid_payload(self):
        serializer = PasswordResetRequestSerializer(
            data={
                "email": "  JOHN@example.COM ",
                "current_password": "StrongPassword123!",
                "new_password": "NewStrongPassword123!",
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["email"], "john@example.com")

    def test_password_reset_serializer_requires_fields(self):
        serializer = PasswordResetRequestSerializer(data={})

        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)
        self.assertIn("current_password", serializer.errors)
        self.assertIn("new_password", serializer.errors)

    def test_password_reset_serializer_rejects_invalid_email(self):
        serializer = PasswordResetRequestSerializer(
            data={
                "email": "not-an-email",
                "current_password": "StrongPassword123!",
                "new_password": "NewStrongPassword123!",
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

    def test_password_reset_serializer_rejects_weak_password(self):
        serializer = PasswordResetRequestSerializer(
            data={
                "email": "john@example.com",
                "current_password": "StrongPassword123!",
                "new_password": "weak",
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("new_password", serializer.errors)
        self.assertEqual(serializer.errors["new_password"][0], PASSWORD_RULES_MESSAGE)


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


class PasswordResetServiceUnitTests(TestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create(
            email="john@example.com",
            password_hash=make_password("StrongPassword123!"),
            first_name="John",
            last_name="Doe",
            role="USER",
        )

    def test_password_reset_updates_hash_and_revokes_active_refresh_tokens(self):
        active_token = RefreshToken.objects.create(
            user=self.user,
            token="active-token",
            revoked=False,
            expires_at=timezone.now() + timedelta(days=7),
        )
        revoked_token = RefreshToken.objects.create(
            user=self.user,
            token="revoked-token",
            revoked=True,
            expires_at=timezone.now() + timedelta(days=7),
        )

        response = reset_user_password(
            self.user.id,
            email="john@example.com",
            current_password="StrongPassword123!",
            new_password="NewStrongPassword123!",
        )

        self.assertEqual(response["message"], "Password updated.")
        self.user.refresh_from_db()
        self.assertTrue(check_password("NewStrongPassword123!", self.user.password_hash))
        self.assertFalse(check_password("StrongPassword123!", self.user.password_hash))
        active_token.refresh_from_db()
        revoked_token.refresh_from_db()
        self.assertTrue(active_token.revoked)
        self.assertTrue(revoked_token.revoked)

    def test_password_reset_rejects_wrong_current_password(self):
        with self.assertRaisesMessage(UnauthorizedError, "Invalid email or current password."):
            reset_user_password(
                self.user.id,
                email="john@example.com",
                current_password="WrongPassword123!",
                new_password="NewStrongPassword123!",
            )

    def test_password_reset_rejects_email_mismatch(self):
        with self.assertRaisesMessage(UnauthorizedError, "Invalid email or current password."):
            reset_user_password(
                self.user.id,
                email="other@example.com",
                current_password="StrongPassword123!",
                new_password="NewStrongPassword123!",
            )

    def test_password_reset_rejects_unknown_user(self):
        with self.assertRaisesMessage(NotFound, "User not found."):
            reset_user_password(
                uuid.uuid4(),
                email="john@example.com",
                current_password="StrongPassword123!",
                new_password="NewStrongPassword123!",
            )


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


class PasswordResetEndpointIntegrationTests(JwtSettingsMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create(
            email="john@example.com",
            password_hash=make_password("StrongPassword123!"),
            first_name="John",
            last_name="Doe",
            role="USER",
        )
        self.other_user = User.objects.create(
            email="jane@example.com",
            password_hash=make_password("StrongPassword123!"),
            first_name="Jane",
            last_name="Doe",
            role="USER",
        )

    def _login(self, email: str, password: str) -> dict:
        response = self.client.post(
            "/api/v1/users/login",
            data={"email": email, "password": password},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        return response.json()

    @staticmethod
    def _auth_header(token: str) -> dict:
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def _mint_access_token_for_subject(self, subject: str, email: str) -> str:
        now = int(timezone.now().timestamp())
        payload = {
            "iss": settings.USERS_JWT_ISSUER,
            "aud": settings.USERS_JWT_AUDIENCE,
            "sub": str(subject),
            "email": email,
            "roles": ["USER"],
            "iat": now,
            "exp": now + settings.USERS_JWT_ACCESS_TTL_SECONDS,
            "jti": str(uuid.uuid4()),
        }
        private_key = settings.USERS_JWT_PRIVATE_KEY.replace("\\n", "\n")
        return jwt.encode(
            payload,
            private_key,
            algorithm="RS256",
            headers={"kid": settings.USERS_JWT_KID},
        )

    def test_password_reset_happy_path_updates_password_and_revokes_refresh_tokens(self):
        login_data = self._login("john@example.com", "StrongPassword123!")
        access_token = login_data["accessToken"]
        old_refresh_token = login_data["refreshToken"]

        response = self.client.patch(
            f"/api/v1/users/{self.user.id}/password/reset-request",
            data={
                "email": "john@example.com",
                "current_password": "StrongPassword123!",
                "new_password": "NewStrongPassword123!",
            },
            format="json",
            **self._auth_header(access_token),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "Password updated."})

        old_login_response = self.client.post(
            "/api/v1/users/login",
            data={"email": "john@example.com", "password": "StrongPassword123!"},
            format="json",
        )
        self.assertEqual(old_login_response.status_code, 401)

        new_login_response = self.client.post(
            "/api/v1/users/login",
            data={"email": "john@example.com", "password": "NewStrongPassword123!"},
            format="json",
        )
        self.assertEqual(new_login_response.status_code, 200)

        refresh_response = self.client.post(
            "/api/v1/users/refresh",
            data={"refreshToken": old_refresh_token},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, 401)

    def test_password_reset_without_token_returns_401(self):
        response = self.client.patch(
            f"/api/v1/users/{self.user.id}/password/reset-request",
            data={
                "email": "john@example.com",
                "current_password": "StrongPassword123!",
                "new_password": "NewStrongPassword123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertEqual(data["status"], 401)
        self.assertEqual(data["error"], "UNAUTHORIZED")
        self.assertEqual(data["path"], f"/api/v1/users/{self.user.id}/password/reset-request")
        self.assertIn("timestamp", data)

    def test_password_reset_with_invalid_token_returns_401(self):
        response = self.client.patch(
            f"/api/v1/users/{self.user.id}/password/reset-request",
            data={
                "email": "john@example.com",
                "current_password": "StrongPassword123!",
                "new_password": "NewStrongPassword123!",
            },
            format="json",
            **self._auth_header("not-a-jwt"),
        )

        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertEqual(data["status"], 401)
        self.assertEqual(data["error"], "UNAUTHORIZED")
        self.assertEqual(data["path"], f"/api/v1/users/{self.user.id}/password/reset-request")

    def test_password_reset_subject_mismatch_returns_403(self):
        other_login_data = self._login("jane@example.com", "StrongPassword123!")

        response = self.client.patch(
            f"/api/v1/users/{self.user.id}/password/reset-request",
            data={
                "email": "john@example.com",
                "current_password": "StrongPassword123!",
                "new_password": "NewStrongPassword123!",
            },
            format="json",
            **self._auth_header(other_login_data["accessToken"]),
        )

        self.assertEqual(response.status_code, 403)
        data = response.json()
        self.assertEqual(data["status"], 403)
        self.assertEqual(data["error"], "FORBIDDEN")
        self.assertEqual(data["path"], f"/api/v1/users/{self.user.id}/password/reset-request")

    def test_password_reset_invalid_payload_returns_400(self):
        login_data = self._login("john@example.com", "StrongPassword123!")

        response = self.client.patch(
            f"/api/v1/users/{self.user.id}/password/reset-request",
            data={"email": "invalid", "current_password": "StrongPassword123!", "new_password": "weak"},
            format="json",
            **self._auth_header(login_data["accessToken"]),
        )

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data["status"], 400)
        self.assertEqual(data["error"], "VALIDATION_ERROR")
        self.assertEqual(data["path"], f"/api/v1/users/{self.user.id}/password/reset-request")

    def test_password_reset_unknown_user_returns_404(self):
        missing_user_id = str(uuid.uuid4())
        token = self._mint_access_token_for_subject(missing_user_id, "ghost@example.com")

        response = self.client.patch(
            f"/api/v1/users/{missing_user_id}/password/reset-request",
            data={
                "email": "ghost@example.com",
                "current_password": "StrongPassword123!",
                "new_password": "NewStrongPassword123!",
            },
            format="json",
            **self._auth_header(token),
        )

        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertEqual(data["status"], 404)
        self.assertEqual(data["error"], "RESOURCE_NOT_FOUND")
        self.assertEqual(data["path"], f"/api/v1/users/{missing_user_id}/password/reset-request")


class UserProfileAndAddressesIntegrationTests(JwtSettingsMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create(
            email="john@example.com",
            password_hash=make_password("StrongPassword123!"),
            first_name="John",
            last_name="Doe",
            phone_number="+40123456789",
            role="USER",
        )
        self.other_user = User.objects.create(
            email="jane@example.com",
            password_hash=make_password("StrongPassword123!"),
            first_name="Jane",
            last_name="Doe",
            role="USER",
        )

    @staticmethod
    def _auth_header(token: str) -> dict:
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def _login(self, email: str, password: str) -> dict:
        response = self.client.post(
            "/api/v1/users/login",
            data={"email": email, "password": password},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_user_profile_get_patch_delete_happy_path(self):
        token = self._login("john@example.com", "StrongPassword123!")["accessToken"]

        get_response = self.client.get(
            f"/api/v1/users/{self.user.id}",
            **self._auth_header(token),
        )
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(get_response.json()["email"], "john@example.com")
        self.assertEqual(get_response.json()["firstName"], "John")

        patch_response = self.client.patch(
            f"/api/v1/users/{self.user.id}",
            data={"firstName": "Johnny", "phoneNumber": "+40111222333"},
            format="json",
            **self._auth_header(token),
        )
        self.assertEqual(patch_response.status_code, 200)
        patch_payload = patch_response.json()
        self.assertEqual(patch_payload["firstName"], "Johnny")
        self.assertEqual(patch_payload["phoneNumber"], "+40111222333")

        delete_response = self.client.delete(
            f"/api/v1/users/{self.user.id}",
            **self._auth_header(token),
        )
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(User.objects.filter(id=self.user.id).exists())

    def test_user_profile_patch_updates_email_and_normalizes(self):
        token = self._login("john@example.com", "StrongPassword123!")["accessToken"]

        response = self.client.patch(
            f"/api/v1/users/{self.user.id}",
            data={"email": "NEW.Email@Example.COM"},
            format="json",
            **self._auth_header(token),
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["email"], "new.email@example.com")

        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "new.email@example.com")

    def test_user_profile_patch_invalid_email_returns_400(self):
        token = self._login("john@example.com", "StrongPassword123!")["accessToken"]

        response = self.client.patch(
            f"/api/v1/users/{self.user.id}",
            data={"email": "invalid-email"},
            format="json",
            **self._auth_header(token),
        )

        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertEqual(payload["status"], 400)
        self.assertEqual(payload["error"], "VALIDATION_ERROR")
        self.assertEqual(payload["path"], f"/api/v1/users/{self.user.id}")

    def test_user_profile_patch_duplicate_email_returns_409(self):
        token = self._login("john@example.com", "StrongPassword123!")["accessToken"]

        response = self.client.patch(
            f"/api/v1/users/{self.user.id}",
            data={"email": "JANE@example.com"},
            format="json",
            **self._auth_header(token),
        )

        self.assertEqual(response.status_code, 409)
        payload = response.json()
        self.assertEqual(payload["status"], 409)
        self.assertEqual(payload["error"], "CONFLICT")
        self.assertEqual(payload["path"], f"/api/v1/users/{self.user.id}")

    def test_user_profile_without_token_returns_401(self):
        response = self.client.get(f"/api/v1/users/{self.user.id}")

        self.assertEqual(response.status_code, 401)
        payload = response.json()
        self.assertEqual(payload["status"], 401)
        self.assertEqual(payload["error"], "UNAUTHORIZED")
        self.assertEqual(payload["path"], f"/api/v1/users/{self.user.id}")

    def test_addresses_without_token_returns_401(self):
        response = self.client.get(f"/api/v1/users/{self.user.id}/addresses")

        self.assertEqual(response.status_code, 401)
        payload = response.json()
        self.assertEqual(payload["status"], 401)
        self.assertEqual(payload["error"], "UNAUTHORIZED")
        self.assertEqual(payload["path"], f"/api/v1/users/{self.user.id}/addresses")

    def test_user_profile_cross_user_access_returns_403(self):
        other_token = self._login("jane@example.com", "StrongPassword123!")["accessToken"]
        response = self.client.get(
            f"/api/v1/users/{self.user.id}",
            **self._auth_header(other_token),
        )

        self.assertEqual(response.status_code, 403)
        payload = response.json()
        self.assertEqual(payload["status"], 403)
        self.assertEqual(payload["error"], "FORBIDDEN")
        self.assertEqual(payload["path"], f"/api/v1/users/{self.user.id}")

    def test_addresses_cross_user_access_returns_403(self):
        other_token = self._login("jane@example.com", "StrongPassword123!")["accessToken"]
        response = self.client.get(
            f"/api/v1/users/{self.user.id}/addresses",
            **self._auth_header(other_token),
        )

        self.assertEqual(response.status_code, 403)
        payload = response.json()
        self.assertEqual(payload["status"], 403)
        self.assertEqual(payload["error"], "FORBIDDEN")
        self.assertEqual(payload["path"], f"/api/v1/users/{self.user.id}/addresses")

    def test_addresses_create_list_update_delete(self):
        token = self._login("john@example.com", "StrongPassword123!")["accessToken"]

        create_response = self.client.post(
            f"/api/v1/users/{self.user.id}/addresses",
            data={
                "street": "Main Street 12",
                "postalCode": "300123",
                "city": "Timisoara",
                "county": "Timis",
                "country": "Romania",
                "isDefault": True,
            },
            format="json",
            **self._auth_header(token),
        )
        self.assertEqual(create_response.status_code, 201)
        created = create_response.json()
        self.assertEqual(created["street"], "Main Street 12")
        self.assertEqual(created["postalCode"], "300123")
        self.assertEqual(created["isDefault"], True)
        address_id = created["id"]

        list_response = self.client.get(
            f"/api/v1/users/{self.user.id}/addresses?page=0&size=20",
            **self._auth_header(token),
        )
        self.assertEqual(list_response.status_code, 200)
        listed = list_response.json()
        self.assertEqual(listed["page"], 0)
        self.assertEqual(listed["size"], 20)
        self.assertEqual(listed["totalElements"], 1)
        self.assertEqual(listed["totalPages"], 1)
        self.assertEqual(len(listed["content"]), 1)
        self.assertEqual(listed["content"][0]["id"], address_id)

        update_response = self.client.patch(
            f"/api/v1/users/{self.user.id}/addresses/{address_id}",
            data={"street": "Updated Street 99", "isDefault": False},
            format="json",
            **self._auth_header(token),
        )
        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["street"], "Updated Street 99")
        self.assertEqual(updated["isDefault"], False)

        delete_response = self.client.delete(
            f"/api/v1/users/{self.user.id}/addresses/{address_id}",
            **self._auth_header(token),
        )
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(Address.objects.filter(id=address_id).exists())
