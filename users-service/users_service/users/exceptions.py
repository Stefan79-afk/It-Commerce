from rest_framework.exceptions import APIException


class ConflictError(APIException):
    status_code = 409
    default_detail = "Resource conflict."
    default_code = "conflict"


class UnauthorizedError(APIException):
    status_code = 401
    default_detail = "Authentication credentials were not provided or are invalid."
    default_code = "unauthorized"
