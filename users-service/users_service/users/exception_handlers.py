from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from .error_utils import (
    build_error_payload,
    default_message_for_status,
    extract_error_message,
)


def standard_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    request = context.get("request")
    path = request.path if request else ""

    if response is None:
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        message = default_message_for_status(status_code)
        return Response(build_error_payload(status_code, message, path), status=status_code)

    status_code = response.status_code
    message = extract_error_message(
        getattr(response, "data", None), default_message_for_status(status_code)
    )
    response.data = build_error_payload(status_code, message, path)
    return response
