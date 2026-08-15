from django.db import connection
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from bakeops.access.permissions import has_role_page_access
from bakeops.api.dashboard import build_dashboard_overview


class CanReadDashboard(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_role_page_access(request.user, {"dashboard"})


class HealthCheckApi(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request: Request) -> Response:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()

        return Response({"status": "ok", "database": "connected"})


class DashboardOverviewApi(APIView):
    permission_classes = (CanReadDashboard,)

    def get(self, request: Request) -> Response:
        requested_date = request.query_params.get("date")
        business_date = parse_date(requested_date) if requested_date else None
        if requested_date and business_date is None:
            raise ValidationError({"date": "Date must use YYYY-MM-DD format."})
        return Response(build_dashboard_overview(business_date))
