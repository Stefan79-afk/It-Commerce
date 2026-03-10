from django.urls import path
from .views import (
    health,
    jwks,
    login,
    logout,
    password_reset_request,
    refresh,
    register,
    user_address_detail,
    user_addresses,
    user_detail,
)

urlpatterns = [
    path("api/v1/health", health, name="health"),
    path("api/v1/users/register", register, name="register"),
    path("api/v1/users/login", login, name="login"),
    path("api/v1/users/refresh", refresh, name="refresh"),
    path("api/v1/users/logout", logout, name="logout"),
    path("api/v1/users/<uuid:userId>", user_detail, name="user-detail"),
    path("api/v1/users/<uuid:userId>/addresses", user_addresses, name="user-addresses"),
    path(
        "api/v1/users/<uuid:userId>/addresses/<uuid:addressId>",
        user_address_detail,
        name="user-address-detail",
    ),
    path(
        "api/v1/users/<uuid:userId>/password/reset-request",
        password_reset_request,
        name="password-reset-request",
    ),
    path(".well-known/jwks.json", jwks, name="jwks"),
]
