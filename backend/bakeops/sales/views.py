from datetime import date, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from bakeops.sales.permissions import CanManageSales
from bakeops.sales.services import build_sales_analysis
from bakeops.sales.profitability import build_profitability_analysis


def six_month_window_start(today: date) -> date:
    month_index = today.year * 12 + today.month - 1 - 5
    return date(month_index // 12, month_index % 12 + 1, 1)


class SalesAnalysisApi(APIView):
    permission_classes = (CanManageSales,)

    def get(self, request: Request) -> Response:
        today = timezone.localdate()
        default_start = six_month_window_start(today)
        try:
            start = date.fromisoformat(request.query_params.get("start", default_start.isoformat()))
            end = date.fromisoformat(request.query_params.get("end", today.isoformat()))
        except ValueError:
            return Response({"detail": "Dates must use YYYY-MM-DD format."}, status=status.HTTP_400_BAD_REQUEST)
        if end < start:
            return Response(
                {"detail": "End date cannot be earlier than start date."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if end - start > timedelta(days=366):
            return Response(
                {"detail": "Sales analysis range cannot exceed 367 days."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        grain = request.query_params.get("grain", "day")
        if grain not in {"day", "week", "month"}:
            return Response(
                {"detail": "grain must be day, week or month."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(build_sales_analysis(start, end, grain))


class ProfitabilityAnalysisApi(APIView):
    permission_classes = (CanManageSales,)

    def get(self, request: Request) -> Response:
        today = timezone.localdate()
        default_start = date(today.year, 1, 1)
        try:
            start = date.fromisoformat(request.query_params.get("start", default_start.isoformat()))
            end = date.fromisoformat(request.query_params.get("end", today.isoformat()))
        except ValueError:
            return Response({"detail": "Dates must use YYYY-MM-DD format."}, status=status.HTTP_400_BAD_REQUEST)
        if end < start:
            return Response({"detail": "End date cannot be earlier than start date."}, status=status.HTTP_400_BAD_REQUEST)
        if end - start > timedelta(days=366):
            return Response({"detail": "Profitability analysis range cannot exceed 367 days."}, status=status.HTTP_400_BAD_REQUEST)
        grain = request.query_params.get("grain", "day")
        if grain not in {"day", "week", "month"}:
            return Response({"detail": "grain must be day, week or month."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(build_profitability_analysis(start, end, grain))
