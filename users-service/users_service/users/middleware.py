from django.http import JsonResponse

from .error_utils import build_error_payload, default_message_for_status


class ApiErrorMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _is_api_request(path: str) -> bool:
        return path.startswith("/api/v1/")

    def __call__(self, request):
        try:
            response = self.get_response(request)
        except Exception:
            if not self._is_api_request(request.path):
                raise

            status_code = 500
            return JsonResponse(
                build_error_payload(
                    status_code, default_message_for_status(status_code), request.path
                ),
                status=status_code,
            )

        if self._is_api_request(request.path) and response.status_code in (404, 405):
            status_code = response.status_code
            return JsonResponse(
                build_error_payload(
                    status_code, default_message_for_status(status_code), request.path
                ),
                status=status_code,
            )

        return response
