from dataclasses import dataclass
import uuid

import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .services import load_public_key


@dataclass
class JwtUser:
    id: str
    email: str
    roles: list[str]

    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_anonymous(self) -> bool:
        return False


class JwtAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth = get_authorization_header(request).split()
        if not auth:
            return None

        if auth[0].lower() != b"bearer":
            return None
        if len(auth) != 2:
            raise AuthenticationFailed("Invalid authorization header.")

        try:
            token = auth[1].decode("utf-8")
        except UnicodeError as exc:
            raise AuthenticationFailed("Invalid authorization header.") from exc

        try:
            payload = jwt.decode(
                token,
                key=load_public_key(),
                algorithms=["RS256"],
                audience=settings.USERS_JWT_AUDIENCE,
                issuer=settings.USERS_JWT_ISSUER,
                options={"require": ["iss", "aud", "sub", "iat", "exp", "jti"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise AuthenticationFailed("Access token has expired.") from exc
        except jwt.InvalidTokenError as exc:
            raise AuthenticationFailed(
                "Authentication credentials were not provided or are invalid."
            ) from exc

        subject = payload.get("sub")
        if subject is None:
            raise AuthenticationFailed("Authentication credentials were not provided or are invalid.")

        try:
            subject_uuid = str(uuid.UUID(str(subject)))
        except (TypeError, ValueError) as exc:
            raise AuthenticationFailed("Authentication credentials were not provided or are invalid.") from exc

        user = JwtUser(
            id=subject_uuid,
            email=str(payload.get("email", "")),
            roles=list(payload.get("roles", [])),
        )
        return user, payload

    def authenticate_header(self, request):
        return "Bearer"