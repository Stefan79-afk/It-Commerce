# Create your views here.

from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(["GET"])
def health(request):
    # Check database connection
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1;")
        cursor.fetchone()

    return Response({"status": "ok"})