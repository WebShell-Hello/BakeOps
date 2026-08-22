from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Max, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.fields import DateTimeField
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from bakeops.employees.models import Employee
from bakeops.events.activity_services import ensure_activity_occurrences
from bakeops.events.models import (
    ActivityCategory,
    ActivityPlan,
    ActivityPlatform,
    ActivityReminderOccurrence,
    BusinessClosure,
    BusinessEvent,
    EventChecklistItem,
    Holiday,
)
from bakeops.events.permissions import CanManageActivityPlans, CanManageEvents, CanReadBusinessDayStatus
from bakeops.events.serializers import (
    BusinessClosureSerializer,
    BusinessEventSerializer,
    EventChecklistItemSerializer,
    HolidaySerializer,
    ActivityCategorySerializer,
    ActivityCategoryCreateSerializer,
    ActivityPlanSerializer,
    ActivityPlatformSerializer,
    ActivityPlatformCreateSerializer,
    ActivityReminderOccurrenceSerializer,
)
from bakeops.events.services import build_event_advice, event_status
from bakeops.products.models import Product


def event_queryset() -> Any:
    return BusinessEvent.objects.select_related("linked_holiday").prefetch_related(
        "focus_products",
        "checklist_items",
    )


class EventOverviewApi(APIView):
    permission_classes = (CanManageEvents,)

    def get(self, request: Request) -> Response:
        today = timezone.localdate()
        try:
            year = int(request.query_params.get("year", today.year))
            year_start = date(year, 1, 1)
            year_end = date(year, 12, 31)
        except (TypeError, ValueError):
            return Response({"detail": "Year must be a valid integer."}, status=status.HTTP_400_BAD_REQUEST)

        events = event_queryset().filter(start_date__lte=year_end, end_date__gte=year_start)
        holidays = Holiday.objects.filter(holiday_date__range=(year_start, year_end))
        closures = BusinessClosure.objects.filter(start_date__lte=year_end, end_date__gte=year_start)
        upcoming_events = event_queryset().filter(start_date__gte=today)
        upcoming_statuses = [event_status(event, today) for event in upcoming_events]
        return Response(
            {
                "year": year,
                "kpis": {
                    "upcoming_count": upcoming_events.count(),
                    "next_30_days_count": upcoming_events.filter(
                        start_date__lte=today + timedelta(days=29)
                    ).count(),
                    "in_preparation_count": sum(
                        value in ("PREPARING", "IMMINENT", "PREPARATION_RISK")
                        for value in upcoming_statuses
                    ),
                    "needs_attention_count": sum(value == "PREPARATION_RISK" for value in upcoming_statuses),
                },
                "product_options": list(
                    Product.objects.filter(sale_status=Product.SaleStatus.ON_SALE)
                    .order_by("name_zh", "name_en")
                    .values("id", "name_zh", "name_en")
                ),
                "events": BusinessEventSerializer(events, many=True).data,
                "holidays": HolidaySerializer(holidays, many=True).data,
                "closures": BusinessClosureSerializer(closures, many=True).data,
            }
        )


class BusinessEventCreateApi(generics.CreateAPIView[BusinessEvent]):
    permission_classes = (CanManageEvents,)
    serializer_class = BusinessEventSerializer


class BusinessEventDetailApi(APIView):
    permission_classes = (CanManageEvents,)

    def get(self, request: Request, pk: object) -> Response:
        event = get_object_or_404(event_queryset(), pk=pk)
        return Response({**BusinessEventSerializer(event).data, **build_event_advice(event)})

    def patch(self, request: Request, pk: object) -> Response:
        event = get_object_or_404(event_queryset(), pk=pk)
        serializer = BusinessEventSerializer(event, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        refreshed = get_object_or_404(event_queryset(), pk=pk)
        return Response(BusinessEventSerializer(refreshed).data)

    def delete(self, request: Request, pk: object) -> Response:
        event = get_object_or_404(BusinessEvent, pk=pk)
        event.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EventChecklistCreateApi(APIView):
    permission_classes = (CanManageEvents,)

    def post(self, request: Request, event_id: object) -> Response:
        event = get_object_or_404(BusinessEvent, pk=event_id)
        serializer = EventChecklistItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = serializer.validated_data["category"]
        maximum = event.checklist_items.filter(category=category).aggregate(value=Max("position"))["value"]
        item = serializer.save(event=event, position=0 if maximum is None else maximum + 1)
        return Response(EventChecklistItemSerializer(item).data, status=status.HTTP_201_CREATED)


class EventChecklistDetailApi(generics.RetrieveUpdateDestroyAPIView[EventChecklistItem]):
    permission_classes = (CanManageEvents,)
    serializer_class = EventChecklistItemSerializer
    queryset = EventChecklistItem.objects.all()


class BusinessClosureListCreateApi(generics.ListCreateAPIView[BusinessClosure]):
    permission_classes = (CanManageEvents,)
    serializer_class = BusinessClosureSerializer
    pagination_class = None

    def get_queryset(self) -> Any:
        queryset = BusinessClosure.objects.all()
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        if start and end:
            queryset = queryset.filter(start_date__lte=end, end_date__gte=start)
        return queryset


class BusinessClosureDetailApi(generics.RetrieveUpdateDestroyAPIView[BusinessClosure]):
    permission_classes = (CanManageEvents,)
    serializer_class = BusinessClosureSerializer
    queryset = BusinessClosure.objects.all()


class BusinessDayStatusApi(APIView):
    permission_classes = (CanReadBusinessDayStatus,)

    def get(self, request: Request) -> Response:
        try:
            target_date = date.fromisoformat(request.query_params["date"])
        except (KeyError, ValueError):
            return Response({"detail": "Date must use YYYY-MM-DD format."}, status=status.HTTP_400_BAD_REQUEST)
        closures = BusinessClosure.objects.filter(start_date__lte=target_date, end_date__gte=target_date)
        return Response(
            {
                "date": target_date.isoformat(),
                "is_open": not closures.exists(),
                "closures": BusinessClosureSerializer(closures, many=True).data,
            }
        )


def activity_plan_queryset() -> Any:
    return ActivityPlan.objects.select_related(
        "category",
        "platform",
        "owner",
        "responsible_employee",
        "reminder_rule",
    ).prefetch_related("focus_products", "occurrences")


class ActivityPlanningOverviewApi(APIView):
    permission_classes = (CanManageActivityPlans,)

    def get(self, request: Request) -> Response:
        today = timezone.localdate()
        try:
            start = date.fromisoformat(request.query_params.get("start", today.isoformat()))
            end = date.fromisoformat(request.query_params.get("end", (today + timedelta(days=30)).isoformat()))
        except ValueError:
            return Response({"detail": "Dates must use YYYY-MM-DD format."}, status=status.HTTP_400_BAD_REQUEST)
        if end < start:
            return Response({"detail": "End date cannot be earlier than start date."}, status=status.HTTP_400_BAD_REQUEST)
        if (end - start).days > 366:
            return Response({"detail": "Date range cannot exceed 367 days."}, status=status.HTTP_400_BAD_REQUEST)

        ensure_activity_occurrences(start, end)
        plans = activity_plan_queryset()
        occurrences = (
            ActivityReminderOccurrence.objects.select_related(
                "plan__category", "plan__platform", "plan__responsible_employee"
            )
            .filter(
                Q(scheduled_at__date__range=(start, end))
                | Q(snoozed_until__date__range=(start, end))
            )
            .order_by("scheduled_at", "plan__name")
        )
        occurrence_data = ActivityReminderOccurrenceSerializer(occurrences, many=True).data
        return Response(
            {
                "range": {"start": start.isoformat(), "end": end.isoformat()},
                "categories": ActivityCategorySerializer(
                    ActivityCategory.objects.filter(is_active=True), many=True
                ).data,
                "platforms": ActivityPlatformSerializer(
                    ActivityPlatform.objects.filter(is_active=True).select_related("category"), many=True
                ).data,
                "owner_options": list(
                    Employee.objects.filter(status=Employee.Status.ACTIVE, deleted_at__isnull=True)
                    .order_by("employee_number", "name")
                    .values("id", "name", "position")
                ),
                "product_options": list(
                    Product.objects.filter(sale_status=Product.SaleStatus.ON_SALE)
                    .order_by("name_zh", "name_en")
                    .values("id", "name_zh", "name_en")
                ),
                "plans": ActivityPlanSerializer(plans, many=True).data,
                "occurrences": occurrence_data,
                "kpis": {
                    "today_pending": sum(
                        item["display_status"] in ("PENDING", "OVERDUE")
                        and item["effective_at"][:10] == today.isoformat()
                        for item in occurrence_data
                    ),
                    "overdue": sum(item["display_status"] == "OVERDUE" for item in occurrence_data),
                    "range_pending": sum(item["display_status"] == "PENDING" for item in occurrence_data),
                    "active_plans": plans.filter(status=ActivityPlan.Status.ACTIVE).count(),
                },
            }
        )


class ActivityPlanListCreateApi(generics.ListCreateAPIView[ActivityPlan]):
    permission_classes = (CanManageActivityPlans,)
    serializer_class = ActivityPlanSerializer
    pagination_class = None

    def get_queryset(self) -> Any:
        return activity_plan_queryset()


class ActivityCategoryListCreateApi(APIView):
    permission_classes = (CanManageActivityPlans,)

    def get(self, request: Request) -> Response:
        categories = ActivityCategory.objects.filter(is_active=True)
        return Response(ActivityCategorySerializer(categories, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = ActivityCategoryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        return Response(ActivityCategorySerializer(category).data, status=status.HTTP_201_CREATED)


class ActivityPlatformListCreateApi(APIView):
    permission_classes = (CanManageActivityPlans,)

    def get(self, request: Request) -> Response:
        platforms = ActivityPlatform.objects.filter(is_active=True).select_related("category")
        category_id = request.query_params.get("category_id")
        if category_id:
            platforms = platforms.filter(category_id=category_id)
        return Response(ActivityPlatformSerializer(platforms, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = ActivityPlatformCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        platform = serializer.save()
        return Response(ActivityPlatformSerializer(platform).data, status=status.HTTP_201_CREATED)


class ActivityPlanDetailApi(generics.RetrieveUpdateDestroyAPIView[ActivityPlan]):
    permission_classes = (CanManageActivityPlans,)
    serializer_class = ActivityPlanSerializer
    queryset = activity_plan_queryset()


class ActivityReminderOccurrenceDetailApi(APIView):
    permission_classes = (CanManageActivityPlans,)

    @transaction.atomic
    def patch(self, request: Request, pk: object) -> Response:
        occurrence = get_object_or_404(
            ActivityReminderOccurrence.objects.select_related(
                "plan__category", "plan__platform", "plan__responsible_employee", "rule"
            ).select_for_update(of=("self",)),
            pk=pk,
        )
        next_status = request.data.get("status", occurrence.status)
        if next_status not in ActivityReminderOccurrence.Status.values:
            return Response({"detail": "Invalid reminder status."}, status=status.HTTP_400_BAD_REQUEST)
        occurrence.status = next_status
        occurrence.execution_notes = request.data.get("execution_notes", occurrence.execution_notes)
        occurrence.result_url = request.data.get("result_url", occurrence.result_url)
        snooze_conflict = False
        if "snoozed_until" in request.data:
            requested_snooze = DateTimeField(allow_null=True).run_validation(request.data.get("snoozed_until"))
            if requested_snooze and next_status == ActivityReminderOccurrence.Status.PENDING:
                rule_timezone = ZoneInfo(occurrence.rule.timezone)
                target_date = timezone.localtime(requested_snooze, rule_timezone).date()
                target_start = datetime.combine(target_date, time.min, tzinfo=rule_timezone)
                target_end = target_start + timedelta(days=1)
                conflicts = ActivityReminderOccurrence.objects.select_for_update().filter(
                    plan_id=occurrence.plan_id,
                ).exclude(pk=occurrence.pk).exclude(
                    status__in=(
                        ActivityReminderOccurrence.Status.SKIPPED,
                        ActivityReminderOccurrence.Status.CANCELLED,
                    )
                ).filter(
                    Q(scheduled_at__gte=target_start, scheduled_at__lt=target_end)
                    | Q(snoozed_until__gte=target_start, snoozed_until__lt=target_end)
                )
                snooze_conflict = conflicts.exists()
            if snooze_conflict:
                next_status = ActivityReminderOccurrence.Status.SKIPPED
                occurrence.status = next_status
                occurrence.snoozed_until = None
            else:
                occurrence.snoozed_until = requested_snooze
        if next_status == ActivityReminderOccurrence.Status.COMPLETED:
            occurrence.completed_at = timezone.now()
            occurrence.completed_by = request.user if request.user.is_authenticated else None
            occurrence.snoozed_until = None
        elif next_status == ActivityReminderOccurrence.Status.PENDING:
            occurrence.completed_at = None
            occurrence.completed_by = None
        occurrence.save()
        response_data = ActivityReminderOccurrenceSerializer(occurrence).data
        response_data["snooze_conflict"] = snooze_conflict
        return Response(response_data)
