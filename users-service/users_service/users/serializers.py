import re

from rest_framework import serializers

PASSWORD_RULES_MESSAGE = (
    "Password must be at least 8 characters and include uppercase, lowercase, "
    "digit, and special character."
)
PHONE_RULES_MESSAGE = (
    "Phone number must be in E.164 format, for example +40123456789."
)


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
