from django.utils import timezone

ERROR_CODE_BY_STATUS = {
    400: "VALIDATION_ERROR",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "RESOURCE_NOT_FOUND",
    405: "VALIDATION_ERROR",
    409: "CONFLICT",
    500: "INTERNAL_ERROR",
}

DEFAULT_MESSAGE_BY_STATUS = {
    400: "Request validation failed.",
    401: "Authentication credentials were not provided or are invalid.",
    403: "You do not have permission to perform this action.",
    404: "Resource not found.",
    405: "Method not allowed.",
    409: "Resource conflict.",
    500: "Internal server error.",
}


def current_timestamp_iso() -> str:
    return timezone.now().isoformat().replace("+00:00", "Z")


def default_message_for_status(status_code: int) -> str:
    return DEFAULT_MESSAGE_BY_STATUS.get(status_code, DEFAULT_MESSAGE_BY_STATUS[500])


def error_code_for_status(status_code: int) -> str:
    return ERROR_CODE_BY_STATUS.get(status_code, ERROR_CODE_BY_STATUS[500])


def extract_error_message(error_data, fallback: str) -> str:
    if error_data in (None, ""):
        return fallback

    if isinstance(error_data, dict):
        if "message" in error_data:
            return extract_error_message(error_data["message"], fallback)
        if "detail" in error_data:
            return extract_error_message(error_data["detail"], fallback)

        first_value = next(iter(error_data.values()), fallback)
        return extract_error_message(first_value, fallback)

    if isinstance(error_data, list):
        if not error_data:
            return fallback
        return extract_error_message(error_data[0], fallback)

    return str(error_data)


def build_error_payload(status_code: int, message: str, path: str) -> dict:
    return {
        "timestamp": current_timestamp_iso(),
        "status": status_code,
        "error": error_code_for_status(status_code),
        "message": message,
        "path": path,
    }
