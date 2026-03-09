from django.urls import path
from .views import health, jwks, login, logout, refresh, register

urlpatterns = [
    path("api/v1/health", health, name="health"),
    path("api/v1/users/register", register, name="register"),
    path("api/v1/users/login", login, name="login"),
    path("api/v1/users/refresh", refresh, name="refresh"),
    path("api/v1/users/logout", logout, name="logout"),
    path(".well-known/jwks.json", jwks, name="jwks"),
]
