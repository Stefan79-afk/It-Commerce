from rest_framework.exceptions import APIException


class ConflictError(APIException):
    status_code = 409
    default_detail = "Resource conflict."
    default_code = "conflict"
