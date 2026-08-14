from typing import Any

from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer
from rest_framework.views import APIView

from bakeops.employees.models import Employee
from bakeops.scheduling.models import ScheduleEntry
from bakeops.scheduling.permissions import CanManageSchedules
from bakeops.scheduling.serializers import ScheduleBulkDeleteSerializer, ScheduleEntrySerializer


def authenticated_user_or_none(request: Request) -> Any:
    return request.user if request.user.is_authenticated else None


class ActiveScheduleEmployeeListApi(APIView):
    permission_classes = (CanManageSchedules,)

    def get(self, request: Request) -> Response:
        employees = Employee.objects.filter(
            status=Employee.Status.ACTIVE,
            deleted_at__isnull=True,
            hire_date__lte=timezone.localdate(),
        ).values(
            "id", "name", "position"
        )
        return Response(list(employees))


class ScheduleEntryListCreateApi(generics.ListCreateAPIView[ScheduleEntry]):
    permission_classes = (CanManageSchedules,)
    serializer_class = ScheduleEntrySerializer
    pagination_class = None

    def get_queryset(self) -> Any:
        date_from = parse_date(self.request.query_params.get("date_from", ""))
        date_to = parse_date(self.request.query_params.get("date_to", ""))
        if date_from is None or date_to is None:
            raise ValidationError({"detail": "date_from and date_to are required in YYYY-MM-DD format."})
        if date_to < date_from:
            raise ValidationError({"detail": "date_to cannot be earlier than date_from."})
        if (date_to - date_from).days > 370:
            raise ValidationError({"detail": "The requested schedule range cannot exceed 371 days."})
        return ScheduleEntry.objects.filter(work_date__range=(date_from, date_to)).select_related("employee")

    def perform_create(self, serializer: BaseSerializer[ScheduleEntry]) -> None:
        actor = authenticated_user_or_none(self.request)
        serializer.save(created_by=actor, updated_by=actor)


class ScheduleEntryDetailApi(generics.RetrieveUpdateDestroyAPIView[ScheduleEntry]):
    permission_classes = (CanManageSchedules,)
    serializer_class = ScheduleEntrySerializer
    queryset = ScheduleEntry.objects.all()

    def perform_update(self, serializer: BaseSerializer[ScheduleEntry]) -> None:
        serializer.save(updated_by=authenticated_user_or_none(self.request))


class ScheduleBulkDeleteApi(APIView):
    permission_classes = (CanManageSchedules,)

    def post(self, request: Request) -> Response:
        serializer = ScheduleBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ScheduleEntry.objects.filter(
            id__in=serializer.validated_data["schedule_ids"],
        ).delete()
        return Response(status=204)
