from django.urls import path
from .views import health, register

urlpatterns = [
    path("api/v1/health", health, name="health"),
    path("api/v1/users/register", register, name="register"),
]
