from django.urls import path
from .views import health, jwks, login, register

urlpatterns = [
    path("api/v1/health", health, name="health"),
    path("api/v1/users/register", register, name="register"),
    path("api/v1/users/login", login, name="login"),
    path(".well-known/jwks.json", jwks, name="jwks"),
]
