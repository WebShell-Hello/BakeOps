from datetime import date, timedelta

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from bakeops.sales.models import SalesDataRecord, SalesOrderLine
from bakeops.sales.permissions import CanManageSales
from bakeops.sales.profitability import build_profitability_analysis
from bakeops.sales.record_services import delete_sales_records, import_sales_records, update_sales_record
from bakeops.sales.sales_data_services import delete_sales_data, import_sales_data, update_sales_data
from bakeops.sales.serializers import (
    SalesDataBulkDeleteSerializer,
    SalesDataImportSerializer,
    SalesDataSerializer,
    SalesDataWriteSerializer,
    SalesRecordBulkDeleteSerializer,
    SalesRecordImportSerializer,
    SalesRecordSerializer,
    SalesRecordWriteSerializer,
)
from bakeops.sales.services import build_sales_analysis


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
        channel = request.query_params.get("channel", "").strip()
        if channel and channel not in SalesDataRecord.Channel.values:
            return Response(
                {"detail": "channel must be DIRECT, CONSIGNMENT or DELIVERY."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(build_sales_analysis(start, end, grain, channel or None))


def sales_record_queryset():
    return SalesOrderLine.objects.select_related("order", "product").order_by(
        "-order__sold_at",
        "order__reference",
        "product_name_en",
    )


class SalesRecordListApi(APIView):
    permission_classes = (CanManageSales,)

    def get(self, request: Request) -> Response:
        queryset = sales_record_queryset()
        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(order__reference__icontains=search)
                | Q(product_name_zh__icontains=search)
                | Q(product_name_en__icontains=search)
            )
        start = request.query_params.get("start", "").strip()
        end = request.query_params.get("end", "").strip()
        try:
            if start:
                queryset = queryset.filter(order__sold_at__date__gte=date.fromisoformat(start))
            if end:
                queryset = queryset.filter(order__sold_at__date__lte=date.fromisoformat(end))
        except ValueError:
            return Response(
                {"detail": "Dates must use YYYY-MM-DD format."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(SalesRecordSerializer(queryset, many=True).data)


class SalesRecordDetailApi(APIView):
    permission_classes = (CanManageSales,)

    def get_object(self, pk: str) -> SalesOrderLine:
        return get_object_or_404(sales_record_queryset(), pk=pk)

    def put(self, request: Request, pk: str) -> Response:
        line = self.get_object(pk)
        serializer = SalesRecordWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = update_sales_record(line, serializer.validated_data)
        return Response(SalesRecordSerializer(updated).data)

    def delete(self, request: Request, pk: str) -> Response:
        self.get_object(pk)
        delete_sales_records([pk])
        return Response(status=status.HTTP_204_NO_CONTENT)


class SalesRecordImportApi(APIView):
    permission_classes = (CanManageSales,)

    def post(self, request: Request) -> Response:
        serializer = SalesRecordImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created = import_sales_records(serializer.validated_data["records"])
        refreshed = sales_record_queryset().filter(id__in=[line.id for line in created])
        return Response(
            {
                "created_count": len(created),
                "records": SalesRecordSerializer(refreshed, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


class SalesRecordBulkDeleteApi(APIView):
    permission_classes = (CanManageSales,)

    def post(self, request: Request) -> Response:
        serializer = SalesRecordBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        delete_sales_records(serializer.validated_data["line_ids"])
        return Response(status=status.HTTP_204_NO_CONTENT)


def sales_data_queryset():
    return SalesDataRecord.objects.select_related("product").order_by(
        "-sales_date",
        "channel",
        "product_name_en",
    )


class SalesDataListApi(APIView):
    permission_classes = (CanManageSales,)

    def get(self, request: Request) -> Response:
        queryset = sales_data_queryset()
        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(product__code__icontains=search)
                | Q(product_name_zh__icontains=search)
                | Q(product_name_en__icontains=search)
            )
        channel = request.query_params.get("channel", "").strip()
        if channel:
            if channel not in SalesDataRecord.Channel.values:
                return Response(
                    {"detail": "channel must be DIRECT, CONSIGNMENT or DELIVERY."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            queryset = queryset.filter(channel=channel)
        start = request.query_params.get("start", "").strip()
        end = request.query_params.get("end", "").strip()
        try:
            if start:
                queryset = queryset.filter(sales_date__gte=date.fromisoformat(start))
            if end:
                queryset = queryset.filter(sales_date__lte=date.fromisoformat(end))
        except ValueError:
            return Response(
                {"detail": "Dates must use YYYY-MM-DD format."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(SalesDataSerializer(queryset, many=True).data)


class SalesDataDetailApi(APIView):
    permission_classes = (CanManageSales,)

    def get_object(self, pk: str) -> SalesDataRecord:
        return get_object_or_404(sales_data_queryset(), pk=pk)

    def put(self, request: Request, pk: str) -> Response:
        record = self.get_object(pk)
        serializer = SalesDataWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = update_sales_data(record, serializer.validated_data)
        return Response(SalesDataSerializer(updated).data)

    def delete(self, request: Request, pk: str) -> Response:
        self.get_object(pk)
        delete_sales_data([pk])
        return Response(status=status.HTTP_204_NO_CONTENT)


class SalesDataImportApi(APIView):
    permission_classes = (CanManageSales,)

    def post(self, request: Request) -> Response:
        serializer = SalesDataImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created = import_sales_data(serializer.validated_data["records"])
        refreshed = sales_data_queryset().filter(id__in=[record.id for record in created])
        return Response(
            {
                "created_count": len(created),
                "records": SalesDataSerializer(refreshed, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


class SalesDataBulkDeleteApi(APIView):
    permission_classes = (CanManageSales,)

    def post(self, request: Request) -> Response:
        serializer = SalesDataBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        delete_sales_data(serializer.validated_data["record_ids"])
        return Response(status=status.HTTP_204_NO_CONTENT)


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
            return Response(
                {"detail": "End date cannot be earlier than start date."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if end - start > timedelta(days=366):
            return Response(
                {"detail": "Profitability analysis range cannot exceed 367 days."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        grain = request.query_params.get("grain", "day")
        if grain not in {"day", "week", "month"}:
            return Response({"detail": "grain must be day, week or month."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(build_profitability_analysis(start, end, grain))
