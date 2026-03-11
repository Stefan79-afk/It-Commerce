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
from rest_framework.exceptions import APIException, NotFound

from .exceptions import ConflictError, UnauthorizedError
from .models import Address, RefreshToken, User


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


def load_private_key():
    key_data = settings.USERS_JWT_PRIVATE_KEY.replace("\\n", "\n").strip()
    if not key_data:
        raise APIException("JWT private key is not configured.")

    try:
        return serialization.load_pem_private_key(key_data.encode("utf-8"), password=None)
    except ValueError as exc:
        raise APIException("JWT private key is invalid.") from exc


def load_public_key():
    private_key = load_private_key()
    return private_key.public_key()


def get_jwks_payload() -> dict:
    public_key = load_public_key()
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


def _issue_access_token(user: User, now=None) -> str:
    current_time = now or timezone.now()
    claims = _build_access_token_claims(user, current_time)
    return jwt.encode(
        claims,
        load_private_key(),
        algorithm="RS256",
        headers={"kid": settings.USERS_JWT_KID},
    )


def _create_refresh_token(user: User, now=None) -> RefreshToken:
    current_time = now or timezone.now()
    refresh_expires_at = current_time + timedelta(
        seconds=settings.USERS_JWT_REFRESH_TTL_SECONDS
    )
    refresh_token_value = secrets.token_urlsafe(48)
    return RefreshToken.objects.create(
        user=user,
        token=refresh_token_value,
        revoked=False,
        expires_at=refresh_expires_at,
    )


def _get_active_refresh_token(refresh_token_value: str) -> RefreshToken:
    refresh_token = (
        RefreshToken.objects.select_related("user")
        .filter(token=refresh_token_value)
        .first()
    )
    if refresh_token is None:
        raise UnauthorizedError("Invalid refresh token.")
    if refresh_token.revoked:
        raise UnauthorizedError("Refresh token has been revoked.")
    if refresh_token.expires_at <= timezone.now():
        raise UnauthorizedError("Refresh token has expired.")
    return refresh_token


def authenticate_user_and_issue_tokens(email: str, password: str) -> dict:
    normalized_email = email.strip().lower()
    user = User.objects.filter(email=normalized_email).first()
    if user is None or not check_password(password, user.password_hash):
        raise UnauthorizedError("Invalid email or password.")

    now = timezone.now()
    access_token = _issue_access_token(user, now=now)
    refresh_token = _create_refresh_token(user, now=now)
    return {
        "accessToken": access_token,
        "refreshToken": refresh_token.token,
        "expiresIn": settings.USERS_JWT_ACCESS_TTL_SECONDS,
    }


def refresh_access_token(refresh_token_value: str) -> dict:
    refresh_token = _get_active_refresh_token(refresh_token_value)
    now = timezone.now()
    access_token = _issue_access_token(refresh_token.user, now=now)
    response = {
        "accessToken": access_token,
        "expiresIn": settings.USERS_JWT_ACCESS_TTL_SECONDS,
    }

    if settings.USERS_ROTATE_REFRESH_TOKENS:
        with transaction.atomic():
            refresh_token.revoked = True
            refresh_token.save(update_fields=["revoked"])
            new_refresh_token = _create_refresh_token(refresh_token.user, now=now)
        response["refreshToken"] = new_refresh_token.token

    return response


def logout_with_refresh_token(refresh_token_value: str) -> dict:
    refresh_token = _get_active_refresh_token(refresh_token_value)
    refresh_token.revoked = True
    refresh_token.save(update_fields=["revoked"])

    return {
        "message": "Logged out successfully.",
    }


def reset_user_password(
    user_id,
    email: str,
    current_password: str,
    new_password: str,
) -> dict:
    user = User.objects.filter(id=user_id).first()
    if user is None:
        raise NotFound("User not found.")

    if user.email != email.strip().lower() or not check_password(
        current_password, user.password_hash
    ):
        raise UnauthorizedError("Invalid email or current password.")

    with transaction.atomic():
        user.password_hash = make_password(new_password)
        user.save(update_fields=["password_hash", "updated_at"])
        RefreshToken.objects.filter(user=user, revoked=False).update(revoked=True)

    return {"message": "Password updated."}


def get_user_or_404(user_id) -> User:
    user = User.objects.filter(id=user_id).first()
    if user is None:
        raise NotFound("User not found.")
    return user


def update_user_profile(user_id, updates: dict) -> User:
    user = get_user_or_404(user_id)
    update_fields = []

    if "email" in updates:
        user.email = updates["email"]
        update_fields.append("email")
    if "firstName" in updates:
        user.first_name = updates["firstName"]
        update_fields.append("first_name")
    if "lastName" in updates:
        user.last_name = updates["lastName"]
        update_fields.append("last_name")
    if "phoneNumber" in updates:
        user.phone_number = updates["phoneNumber"]
        update_fields.append("phone_number")

    if update_fields:
        try:
            user.save(update_fields=[*update_fields, "updated_at"])
        except IntegrityError as exc:
            if "users_email_key" in str(exc) or "unique" in str(exc).lower():
                raise ConflictError("A user with this email already exists.") from exc
            raise
    return user


def delete_user_profile(user_id) -> None:
    user = get_user_or_404(user_id)
    user.delete()


def list_user_addresses(user_id, page: int, size: int) -> dict:
    get_user_or_404(user_id)

    queryset = Address.objects.filter(user_id=user_id).order_by("-created_at")
    total_elements = queryset.count()
    total_pages = (total_elements + size - 1) // size if total_elements else 0
    offset = page * size
    addresses = list(queryset[offset : offset + size])

    return {
        "content": addresses,
        "page": page,
        "size": size,
        "totalElements": total_elements,
        "totalPages": total_pages,
    }


def create_user_address(user_id, payload: dict) -> Address:
    user = get_user_or_404(user_id)
    return Address.objects.create(
        user=user,
        street=payload["street"],
        postal_code=payload.get("postalCode"),
        city=payload["city"],
        county=payload.get("county"),
        country=payload["country"],
        is_default=payload.get("isDefault", False),
    )


def get_user_address_or_404(user_id, address_id) -> Address:
    get_user_or_404(user_id)
    address = Address.objects.filter(id=address_id, user_id=user_id).first()
    if address is None:
        raise NotFound("Address not found.")
    return address


def update_user_address(user_id, address_id, updates: dict) -> Address:
    address = get_user_address_or_404(user_id, address_id)

    if "street" in updates:
        address.street = updates["street"]
    if "postalCode" in updates:
        address.postal_code = updates["postalCode"]
    if "city" in updates:
        address.city = updates["city"]
    if "county" in updates:
        address.county = updates["county"]
    if "country" in updates:
        address.country = updates["country"]
    if "isDefault" in updates:
        address.is_default = updates["isDefault"]

    if updates:
        address.save(
            update_fields=[
                "street",
                "postal_code",
                "city",
                "county",
                "country",
                "is_default",
                "updated_at",
            ]
        )
    return address


def delete_user_address(user_id, address_id) -> None:
    address = get_user_address_or_404(user_id, address_id)
    address.delete()
