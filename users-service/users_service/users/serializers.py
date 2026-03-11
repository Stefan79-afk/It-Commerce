import re

from rest_framework import serializers

PASSWORD_RULES_MESSAGE = (
    "Password must be at least 8 characters and include uppercase, lowercase, "
    "digit, and special character."
)
PHONE_RULES_MESSAGE = (
    "Phone number must be in E.164 format, for example +40123456789."
)


def validate_strong_password(value: str) -> str:
    if len(value) < 8:
        raise serializers.ValidationError(PASSWORD_RULES_MESSAGE)
    if not re.search(r"[A-Z]", value):
        raise serializers.ValidationError(PASSWORD_RULES_MESSAGE)
    if not re.search(r"[a-z]", value):
        raise serializers.ValidationError(PASSWORD_RULES_MESSAGE)
    if not re.search(r"\d", value):
        raise serializers.ValidationError(PASSWORD_RULES_MESSAGE)
    if not re.search(r"[^A-Za-z0-9]", value):
        raise serializers.ValidationError(PASSWORD_RULES_MESSAGE)
    return value


class RegisterRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    firstName = serializers.CharField(allow_blank=False)
    lastName = serializers.CharField(allow_blank=False)
    phoneNumber = serializers.CharField(required=False, allow_blank=False)

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_firstName(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("This field may not be blank.")
        return cleaned

    def validate_lastName(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("This field may not be blank.")
        return cleaned

    def validate_phoneNumber(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("This field may not be blank.")
        if not re.fullmatch(r"^\+[1-9]\d{7,14}$", cleaned):
            raise serializers.ValidationError(PHONE_RULES_MESSAGE)
        return cleaned

    def validate_password(self, value: str) -> str:
        return validate_strong_password(value)


class RegisterResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField(format="hex_verbose", read_only=True)
    email = serializers.EmailField(read_only=True)
    firstName = serializers.CharField(source="first_name", read_only=True)
    lastName = serializers.CharField(source="last_name", read_only=True)
    phoneNumber = serializers.CharField(source="phone_number", read_only=True, required=False)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    def to_representation(self, instance):
        payload = super().to_representation(instance)
        if payload.get("phoneNumber") in (None, ""):
            payload.pop("phoneNumber", None)
        return payload


class LoginRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False, allow_blank=False)

    def validate_email(self, value: str) -> str:
        return value.strip().lower()


class LoginResponseSerializer(serializers.Serializer):
    accessToken = serializers.CharField()
    refreshToken = serializers.CharField()
    expiresIn = serializers.IntegerField(min_value=1)


class RefreshRequestSerializer(serializers.Serializer):
    refreshToken = serializers.CharField(allow_blank=False, trim_whitespace=False)


class RefreshResponseSerializer(serializers.Serializer):
    accessToken = serializers.CharField()
    expiresIn = serializers.IntegerField(min_value=1)
    refreshToken = serializers.CharField(required=False)


class LogoutRequestSerializer(serializers.Serializer):
    refreshToken = serializers.CharField(allow_blank=False, trim_whitespace=False)


class MessageResponseSerializer(serializers.Serializer):
    message = serializers.CharField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    current_password = serializers.CharField(
        write_only=True, trim_whitespace=False, allow_blank=False
    )
    new_password = serializers.CharField(
        write_only=True, trim_whitespace=False, allow_blank=False
    )

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_new_password(self, value: str) -> str:
        return validate_strong_password(value)


class UserSerializer(serializers.Serializer):
    id = serializers.UUIDField(format="hex_verbose", read_only=True)
    email = serializers.EmailField(read_only=True)
    firstName = serializers.CharField(source="first_name", read_only=True)
    lastName = serializers.CharField(source="last_name", read_only=True)
    phoneNumber = serializers.CharField(
        source="phone_number", read_only=True, required=False
    )
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    def to_representation(self, instance):
        payload = super().to_representation(instance)
        if payload.get("phoneNumber") in (None, ""):
            payload.pop("phoneNumber", None)
        return payload


class UpdateUserRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    firstName = serializers.CharField(required=False, allow_blank=False)
    lastName = serializers.CharField(required=False, allow_blank=False)
    phoneNumber = serializers.CharField(
        required=False, allow_blank=False, allow_null=True
    )

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_firstName(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("This field may not be blank.")
        return cleaned

    def validate_lastName(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("This field may not be blank.")
        return cleaned

    def validate_phoneNumber(self, value):
        if value is None:
            return None

        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("This field may not be blank.")
        if not re.fullmatch(r"^\+[1-9]\d{7,14}$", cleaned):
            raise serializers.ValidationError(PHONE_RULES_MESSAGE)
        return cleaned


class AddressSerializer(serializers.Serializer):
    id = serializers.UUIDField(format="hex_verbose", read_only=True)
    street = serializers.CharField(read_only=True)
    postalCode = serializers.CharField(
        source="postal_code", read_only=True, required=False
    )
    city = serializers.CharField(read_only=True)
    county = serializers.CharField(read_only=True, required=False)
    country = serializers.CharField(read_only=True)
    isDefault = serializers.BooleanField(source="is_default", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    def to_representation(self, instance):
        payload = super().to_representation(instance)
        if payload.get("postalCode") in (None, ""):
            payload.pop("postalCode", None)
        if payload.get("county") in (None, ""):
            payload.pop("county", None)
        return payload


class CreateAddressRequestSerializer(serializers.Serializer):
    street = serializers.CharField(allow_blank=False)
    postalCode = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    city = serializers.CharField(allow_blank=False)
    county = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    country = serializers.CharField(allow_blank=False)
    isDefault = serializers.BooleanField(required=False, default=False)

    def validate_street(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("This field may not be blank.")
        return cleaned

    def validate_city(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("This field may not be blank.")
        return cleaned

    def validate_country(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("This field may not be blank.")
        return cleaned

    def validate_postalCode(self, value):
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    def validate_county(self, value):
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class UpdateAddressRequestSerializer(serializers.Serializer):
    street = serializers.CharField(required=False, allow_blank=False)
    postalCode = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    city = serializers.CharField(required=False, allow_blank=False)
    county = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    country = serializers.CharField(required=False, allow_blank=False)
    isDefault = serializers.BooleanField(required=False)

    def validate_street(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("This field may not be blank.")
        return cleaned

    def validate_city(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("This field may not be blank.")
        return cleaned

    def validate_country(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("This field may not be blank.")
        return cleaned

    def validate_postalCode(self, value):
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    def validate_county(self, value):
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None
