from django.db import connection
from django.db.utils import DatabaseError
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import APIException
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .authentication import JwtAuthentication
from .serializers import (
    LoginRequestSerializer,
    LoginResponseSerializer,
    LogoutRequestSerializer,
    MessageResponseSerializer,
    PasswordResetRequestSerializer,
    RefreshRequestSerializer,
    RefreshResponseSerializer,
    RegisterRequestSerializer,
    RegisterResponseSerializer,
)
from .services import (
    authenticate_user_and_issue_tokens,
    create_user_from_register_payload,
    get_jwks_payload,
    logout_with_refresh_token,
    reset_user_password,
    refresh_access_token,
)


@api_view(["GET"])
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
            cursor.fetchone()
    except DatabaseError as exc:
        raise APIException("Database connectivity check failed.") from exc

    return Response({"status": "UP"})


@api_view(["POST"])
def register(request):
    serializer = RegisterRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = create_user_from_register_payload(serializer.validated_data)
    response_payload = RegisterResponseSerializer(user).data
    return Response(response_payload, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def login(request):
    serializer = LoginRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    response_payload = authenticate_user_and_issue_tokens(**serializer.validated_data)
    return Response(LoginResponseSerializer(response_payload).data, status=status.HTTP_200_OK)


@api_view(["POST"])
def refresh(request):
    serializer = RefreshRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    response_payload = refresh_access_token(serializer.validated_data["refreshToken"])
    return Response(RefreshResponseSerializer(response_payload).data, status=status.HTTP_200_OK)


@api_view(["POST"])
def logout(request):
    serializer = LogoutRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    response_payload = logout_with_refresh_token(serializer.validated_data["refreshToken"])
    return Response(MessageResponseSerializer(response_payload).data, status=status.HTTP_200_OK)


@api_view(["GET"])
def jwks(request):
    return Response(get_jwks_payload(), status=status.HTTP_200_OK)


@api_view(["PATCH"])
@authentication_classes([JwtAuthentication])
@permission_classes([IsAuthenticated])
def password_reset_request(request, userId):
    token_subject = str(request.auth.get("sub", ""))
    if token_subject != str(userId):
        raise PermissionDenied("You do not have permission to perform this action.")

    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    response_payload = reset_user_password(userId, **serializer.validated_data)
    return Response(MessageResponseSerializer(response_payload).data, status=status.HTTP_200_OK)
