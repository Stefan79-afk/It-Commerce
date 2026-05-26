import uuid

from django.db import models


class User(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=255, unique=True)
    password_hash = models.CharField(max_length=255)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=30, blank=True, null=True)
    role = models.CharField(max_length=50, default="USER")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users"
        indexes = [
            models.Index(fields=["email"], name="idx_users_email"),
        ]


class RefreshToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="refresh_tokens",
        db_index=False,
    )
    token = models.CharField(max_length=255, unique=True)
    revoked = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "refresh_tokens"
        indexes = [
            models.Index(fields=["user"], name="idx_refresh_tokens_user"),
        ]


class Address(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="addresses",
        db_index=False,
    )
    street = models.CharField(max_length=255)
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    city = models.CharField(max_length=100)
    county = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "addresses"
        indexes = [
            models.Index(fields=["user"], name="idx_addresses_user"),
        ]
