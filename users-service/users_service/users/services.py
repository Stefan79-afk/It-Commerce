from django.contrib.auth.hashers import make_password
from django.db import IntegrityError, transaction

from .exceptions import ConflictError
from .models import User


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
