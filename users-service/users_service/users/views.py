from django.db import connection
from django.db.utils import DatabaseError
from rest_framework.decorators import api_view
from rest_framework.exceptions import APIException
from rest_framework.response import Response


@api_view(["GET"])
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
            cursor.fetchone()
    except DatabaseError as exc:
        raise APIException("Database connectivity check failed.") from exc

    return Response({"status": "UP"})
