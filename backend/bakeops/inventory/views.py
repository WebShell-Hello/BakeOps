from datetime import date, timedelta
from pathlib import Path

from django.db.models import Count, Q, Sum
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from bakeops.employees.models import Employee
from bakeops.inventory.models import InventoryReceipt, ProductionPlan
from bakeops.inventory.permissions import CanManageInventory, CanManageProductionPlans
from bakeops.inventory.serializers import (
    InventoryReceiptBulkDeleteSerializer,
    InventoryReceiptSerializer,
    InventoryReceiptWriteSerializer,
    ProductionPlanBatchSerializer,
    ProductionPlanSerializer,
    ProductionPlanUpdateSerializer,
    PurchaseRequestCreateSerializer,
    PurchaseRequestSerializer,
)
from bakeops.inventory.services import (
    InventoryReceiptDeletionError,
    build_inventory_snapshot,
    delete_inventory_receipts,
)
from bakeops.products.models import Product


class InventoryOverviewApi(APIView):
    permission_classes = (CanManageInventory,)

    def get(self, request: Request) -> Response:
        return Response(build_inventory_snapshot())


class PurchaseRequestCreateApi(APIView):
    permission_classes = (CanManageInventory,)

    def post(self, request: Request) -> Response:
        serializer = PurchaseRequestCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        purchase_request = serializer.save()
        return Response(PurchaseRequestSerializer(purchase_request).data, status=status.HTTP_201_CREATED)


class InventoryReceiptRecorderOptionsApi(APIView):
    permission_classes = (CanManageInventory,)

    def get(self, request: Request) -> Response:
        employees = (
            Employee.objects.filter(status=Employee.Status.ACTIVE, deleted_at__isnull=True)
            .order_by("employee_number")
            .values("id", "name", "position")
        )
        return Response(list(employees))


class InventoryReceiptCreateApi(APIView):
    permission_classes = (CanManageInventory,)

    def get(self, request: Request) -> Response:
        receipts = InventoryReceipt.objects.select_related("ingredient", "supplier", "recorded_by_employee")
        search = request.query_params.get("search", "").strip()
        start = request.query_params.get("start", "").strip()
        end = request.query_params.get("end", "").strip()
        if search:
            receipts = receipts.filter(
                Q(reference__icontains=search)
                | Q(ingredient__name__icontains=search)
                | Q(supplier__name__icontains=search)
                | Q(notes__icontains=search)
                | Q(recorded_by_employee__name__icontains=search)
                | Q(recorded_by_employee__employee_number__icontains=search)
            )
        try:
            if start:
                receipts = receipts.filter(received_at__date__gte=date.fromisoformat(start))
            if end:
                receipts = receipts.filter(received_at__date__lte=date.fromisoformat(end))
        except ValueError:
            return Response(
                {"detail": "start and end must use YYYY-MM-DD format."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(InventoryReceiptSerializer(receipts, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = InventoryReceiptWriteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        receipt = serializer.save()
        return Response(InventoryReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)


class InventoryReceiptDetailApi(APIView):
    permission_classes = (CanManageInventory,)

    def get_object(self, pk: str) -> InventoryReceipt:
        return get_object_or_404(
            InventoryReceipt.objects.select_related("ingredient", "supplier", "recorded_by_employee"),
            pk=pk,
        )

    def get(self, request: Request, pk: str) -> Response:
        return Response(InventoryReceiptSerializer(self.get_object(pk)).data)

    def patch(self, request: Request, pk: str) -> Response:
        receipt = self.get_object(pk)
        serializer = InventoryReceiptWriteSerializer(
            receipt,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        return Response(InventoryReceiptSerializer(serializer.save()).data)

    def delete(self, request: Request, pk: str) -> Response:
        self.get_object(pk)
        try:
            delete_inventory_receipts([pk])
        except InventoryReceiptDeletionError as error:
            raise ValidationError({"detail": str(error)}) from error
        return Response(status=status.HTTP_204_NO_CONTENT)


class InventoryReceiptBulkDeleteApi(APIView):
    permission_classes = (CanManageInventory,)

    def post(self, request: Request) -> Response:
        serializer = InventoryReceiptBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            delete_inventory_receipts(serializer.validated_data["receipt_ids"])
        except InventoryReceiptDeletionError as error:
            raise ValidationError({"receipt_ids": str(error)}) from error
        return Response(status=status.HTTP_204_NO_CONTENT)


class InventoryReceiptInvoiceApi(APIView):
    permission_classes = (CanManageInventory,)

    def get(self, request: Request, pk: str) -> FileResponse:
        receipt = get_object_or_404(InventoryReceipt, pk=pk)
        if not receipt.invoice:
            raise Http404("This receipt has no invoice attachment.")
        try:
            receipt.invoice.open("rb")
        except (FileNotFoundError, OSError) as error:
            raise Http404("Invoice attachment is unavailable.") from error
        return FileResponse(
            receipt.invoice,
            as_attachment=True,
            filename=receipt.invoice_original_name or Path(receipt.invoice.name).name,
            content_type=receipt.invoice_content_type or "application/octet-stream",
        )


class ProductionPlanListCreateApi(APIView):
    permission_classes = (CanManageProductionPlans,)

    def get(self, request: Request) -> Response:
        today = timezone.localdate()
        try:
            start_date = date.fromisoformat(request.query_params.get("start", today.isoformat()))
            end_date = date.fromisoformat(request.query_params.get("end", (today + timedelta(days=6)).isoformat()))
        except ValueError:
            return Response({"detail": "Dates must use YYYY-MM-DD format."}, status=status.HTTP_400_BAD_REQUEST)
        if end_date < start_date:
            return Response(
                {"detail": "End date cannot be earlier than start date."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if (end_date - start_date).days > 366:
            return Response({"detail": "Date range cannot exceed 367 days."}, status=status.HTTP_400_BAD_REQUEST)

        active = ~Q(status=ProductionPlan.Status.CANCELLED)
        plans = (
            ProductionPlan.objects.filter(planned_date__range=(start_date, end_date))
            .select_related("product")
            .order_by("planned_date", "product__name_zh")
        )
        today_totals = ProductionPlan.objects.filter(active, planned_date=today).aggregate(
            planned=Sum("quantity"), actual=Sum("actual_quantity")
        )
        future_seven = ProductionPlan.objects.filter(
            active,
            planned_date__range=(today, today + timedelta(days=6)),
        ).aggregate(planned=Sum("quantity"))["planned"]
        selected_product_count = ProductionPlan.objects.filter(
            active,
            planned_date__range=(start_date, end_date),
        ).aggregate(count=Count("product", distinct=True))["count"]
        return Response(
            {
                "range": {"start": start_date.isoformat(), "end": end_date.isoformat()},
                "product_options": list(
                    Product.objects.filter(sale_status=Product.SaleStatus.ON_SALE)
                    .order_by("name_zh", "name_en")
                    .values("id", "name_zh", "name_en")
                ),
                "kpis": {
                    "today_planned": today_totals["planned"] or 0,
                    "today_actual": today_totals["actual"] or 0,
                    "future_7_days_planned": future_seven or 0,
                    "planned_product_count": selected_product_count or 0,
                },
                "plans": ProductionPlanSerializer(plans, many=True).data,
            }
        )

    def post(self, request: Request) -> Response:
        serializer = ProductionPlanBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plans = serializer.save()
        plans = ProductionPlan.objects.filter(pk__in=[plan.pk for plan in plans]).select_related("product")
        return Response(ProductionPlanSerializer(plans, many=True).data, status=status.HTTP_201_CREATED)


class ProductionPlanDetailApi(APIView):
    permission_classes = (CanManageProductionPlans,)

    def patch(self, request: Request, pk: object) -> Response:
        plan = get_object_or_404(ProductionPlan.objects.select_related("product"), pk=pk)
        serializer = ProductionPlanUpdateSerializer(plan, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ProductionPlanSerializer(plan).data)

    def delete(self, request: Request, pk: object) -> Response:
        plan = get_object_or_404(ProductionPlan, pk=pk)
        plan.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
