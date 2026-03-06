from django.contrib.auth.hashers import make_password
import base64
import secrets
import uuid
from datetime import timedelta

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from .exceptions import ConflictError, UnauthorizedError
from .models import RefreshToken, User


def create_user_from_register_payload(validated_data: dict) -> User:
    email = validated_data["email"].strip().lower()
    phone_number = validated_data.get("phoneNumber")
    if phone_number is not None:
        phone_number = phone_number.strip()

    try:
        with transaction.atomic():
            return User.objects.create(
                email=email,
                password_hash=make_password(validated_data["password"]),
                first_name=validated_data["firstName"].strip(),
                last_name=validated_data["lastName"].strip(),
                phone_number=phone_number or None,
            )
    except IntegrityError as exc:
        if "users_email_key" in str(exc) or "unique" in str(exc).lower():
            raise ConflictError("A user with this email already exists.") from exc
        raise


def _base64url_uint(value: int) -> str:
    raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _load_private_key():
    key_data = settings.USERS_JWT_PRIVATE_KEY.replace("\\n", "\n").strip()
    if not key_data:
        raise APIException("JWT private key is not configured.")

    try:
        return serialization.load_pem_private_key(key_data.encode("utf-8"), password=None)
    except ValueError as exc:
        raise APIException("JWT private key is invalid.") from exc


def get_jwks_payload() -> dict:
    private_key = _load_private_key()
    public_key = private_key.public_key()
    if not isinstance(public_key, rsa.RSAPublicKey):
        raise APIException("JWT public key is not RSA.")

    public_numbers = public_key.public_numbers()
    return {
        "keys": [
            {
                "kty": "RSA",
                "kid": settings.USERS_JWT_KID,
                "use": "sig",
                "alg": "RS256",
                "n": _base64url_uint(public_numbers.n),
                "e": _base64url_uint(public_numbers.e),
            }
        ]
    }


def _build_access_token_claims(user: User, now) -> dict:
    expires_at = now + timedelta(seconds=settings.USERS_JWT_ACCESS_TTL_SECONDS)
    return {
        "iss": settings.USERS_JWT_ISSUER,
        "aud": settings.USERS_JWT_AUDIENCE,
        "sub": str(user.id),
        "email": user.email,
        "roles": [user.role],
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": str(uuid.uuid4()),
    }


def authenticate_user_and_issue_tokens(email: str, password: str) -> dict:
    normalized_email = email.strip().lower()
    user = User.objects.filter(email=normalized_email).first()

    if user is None or not check_password(password, user.password_hash):
        raise UnauthorizedError("Invalid email or password.")

    now = timezone.now()
    claims = _build_access_token_claims(user, now)
    access_token = jwt.encode(
        claims,
        _load_private_key(),
        algorithm="RS256",
        headers={"kid": settings.USERS_JWT_KID},
    )

    refresh_expires_at = now + timedelta(seconds=settings.USERS_JWT_REFRESH_TTL_SECONDS)
    refresh_token_value = secrets.token_urlsafe(48)
    refresh_token = RefreshToken.objects.create(
        user=user,
        token=refresh_token_value,
        revoked=False,
        expires_at=refresh_expires_at,
    )

    return {
        "accessToken": access_token,
        "refreshToken": refresh_token.token,
        "expiresIn": settings.USERS_JWT_ACCESS_TTL_SECONDS,
    }
