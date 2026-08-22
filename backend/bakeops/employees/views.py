from typing import Any

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from bakeops.costs.services import shift_minutes, shift_wage
from bakeops.employees.models import Employee
from bakeops.employees.permissions import CanManageEmployees
from bakeops.employees.serializers import EmployeeBulkActionSerializer, EmployeeSerializer
from bakeops.scheduling.models import ScheduleEntry
from bakeops.scheduling.serializers import ScheduleEntrySerializer


class EmployeeListCreateApi(generics.ListCreateAPIView[Employee]):
    permission_classes = (CanManageEmployees,)
    serializer_class = EmployeeSerializer
    pagination_class = None

    def get_queryset(self) -> Any:
        deleted = self.request.query_params.get("deleted", "false").strip().lower()
        queryset = Employee.objects.filter(
            deleted_at__isnull=deleted not in {"true", "1"},
        )
        status = self.request.query_params.get("status", "").strip()
        search = self.request.query_params.get("search", "").strip()
        if status:
            queryset = queryset.filter(status=status)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(employee_number__icontains=search)
                | Q(email__icontains=search)
                | Q(position__icontains=search)
            )
        return queryset


class EmployeeDetailApi(generics.RetrieveUpdateDestroyAPIView[Employee]):
    permission_classes = (CanManageEmployees,)
    serializer_class = EmployeeSerializer
    queryset = Employee.objects.filter(deleted_at__isnull=True)

    def perform_destroy(self, instance: Employee) -> None:
        instance.soft_delete()


class EmployeeRestoreApi(APIView):
    permission_classes = (CanManageEmployees,)

    def post(self, request: Request, pk: str) -> Response:
        employee = get_object_or_404(Employee.objects.filter(deleted_at__isnull=False), pk=pk)
        employee.restore()
        return Response(EmployeeSerializer(employee).data)


class EmployeeScheduleHistoryApi(APIView):
    permission_classes = (CanManageEmployees,)

    def get(self, request: Request, pk: str) -> Response:
        employee = get_object_or_404(Employee.objects.all(), pk=pk)
        entries = (
            ScheduleEntry.objects.filter(
                employee=employee,
                work_date__lte=timezone.localdate(),
            )
            .select_related("employee")
            .order_by("-work_date", "-start_time")
        )
        total_minutes = sum(shift_minutes(entry) for entry in entries)
        total_wage = sum((shift_wage(entry) for entry in entries), start=0)
        return Response(
            {
                "employee": EmployeeSerializer(employee).data,
                "summary": {
                    "shift_count": entries.count(),
                    "actual_hours": f"{total_minutes / 60:.2f}",
                    "total_wage": f"{total_wage:.2f}",
                },
                "entries": ScheduleEntrySerializer(entries, many=True).data,
            }
        )


class EmployeeBulkDeleteApi(APIView):
    permission_classes = (CanManageEmployees,)

    def post(self, request: Request) -> Response:
        serializer = EmployeeBulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee_ids = serializer.validated_data["employee_ids"]
        Employee.objects.filter(id__in=employee_ids, deleted_at__isnull=True).update(
            deleted_at=timezone.now(),
            updated_at=timezone.now(),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class EmployeeBulkRestoreApi(APIView):
    permission_classes = (CanManageEmployees,)

    def post(self, request: Request) -> Response:
        serializer = EmployeeBulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee_ids = serializer.validated_data["employee_ids"]
        Employee.objects.filter(id__in=employee_ids, deleted_at__isnull=False).update(
            deleted_at=None,
            updated_at=timezone.now(),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
