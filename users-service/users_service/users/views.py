from django.db import connection
from django.db.utils import DatabaseError
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import APIException
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.serializers import ValidationError
from rest_framework.response import Response

from .authentication import JwtAuthentication
from .serializers import (
    AddressSerializer,
    CreateAddressRequestSerializer,
    LoginRequestSerializer,
    LoginResponseSerializer,
    LogoutRequestSerializer,
    MessageResponseSerializer,
    PasswordResetRequestSerializer,
    RefreshRequestSerializer,
    RefreshResponseSerializer,
    RegisterRequestSerializer,
    RegisterResponseSerializer,
    UpdateAddressRequestSerializer,
    UpdateUserRequestSerializer,
    UserSerializer,
)
from .services import (
    authenticate_user_and_issue_tokens,
    create_user_address,
    create_user_from_register_payload,
    delete_user_address,
    delete_user_profile,
    get_user_or_404,
    get_jwks_payload,
    list_user_addresses,
    logout_with_refresh_token,
    update_user_address,
    update_user_profile,
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


def _ensure_owner(request, user_id):
    token_subject = str(request.auth.get("sub", ""))
    if token_subject != str(user_id):
        raise PermissionDenied("You do not have permission to perform this action.")


def _parse_positive_int(value: str, field_name: str, default: int, minimum: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError({field_name: "A valid integer is required."}) from exc
    if parsed < minimum:
        raise ValidationError({field_name: f"Ensure this value is greater than or equal to {minimum}."})
    return parsed


@api_view(["PATCH"])
@authentication_classes([JwtAuthentication])
@permission_classes([IsAuthenticated])
def password_reset_request(request, userId):
    _ensure_owner(request, userId)

    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    response_payload = reset_user_password(userId, **serializer.validated_data)
    return Response(MessageResponseSerializer(response_payload).data, status=status.HTTP_200_OK)


@api_view(["GET", "PATCH", "DELETE"])
@authentication_classes([JwtAuthentication])
@permission_classes([IsAuthenticated])
def user_detail(request, userId):
    _ensure_owner(request, userId)

    if request.method == "GET":
        user = get_user_or_404(userId)
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)

    if request.method == "PATCH":
        serializer = UpdateUserRequestSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = update_user_profile(userId, serializer.validated_data)
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)

    delete_user_profile(userId)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@authentication_classes([JwtAuthentication])
@permission_classes([IsAuthenticated])
def user_addresses(request, userId):
    _ensure_owner(request, userId)

    if request.method == "GET":
        page = _parse_positive_int(request.query_params.get("page"), "page", default=0, minimum=0)
        size = _parse_positive_int(request.query_params.get("size"), "size", default=20, minimum=1)
        payload = list_user_addresses(userId, page=page, size=size)
        payload["content"] = AddressSerializer(payload["content"], many=True).data
        return Response(payload, status=status.HTTP_200_OK)

    serializer = CreateAddressRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    address = create_user_address(userId, serializer.validated_data)
    return Response(AddressSerializer(address).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@authentication_classes([JwtAuthentication])
@permission_classes([IsAuthenticated])
def user_address_detail(request, userId, addressId):
    _ensure_owner(request, userId)

    if request.method == "PATCH":
        serializer = UpdateAddressRequestSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        address = update_user_address(userId, addressId, serializer.validated_data)
        return Response(AddressSerializer(address).data, status=status.HTTP_200_OK)

    delete_user_address(userId, addressId)
    return Response(status=status.HTTP_204_NO_CONTENT)
