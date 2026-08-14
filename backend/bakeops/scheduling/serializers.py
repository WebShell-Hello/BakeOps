from typing import Any

from rest_framework import serializers

from bakeops.employees.models import Employee
from bakeops.scheduling.models import ScheduleEntry


class ScheduleEntrySerializer(serializers.ModelSerializer[ScheduleEntry]):
    employee_position = serializers.CharField(source="employee.position", read_only=True, default="")
    hourly_rate = serializers.DecimalField(
        source="employee.hourly_rate",
        max_digits=8,
        decimal_places=2,
        read_only=True,
        default=None,
    )
    actual_hours = serializers.SerializerMethodField()
    daily_wage = serializers.SerializerMethodField()
    employee_is_deleted = serializers.SerializerMethodField()
    employee_status = serializers.CharField(source="employee.status", read_only=True, default="")

    class Meta:
        model = ScheduleEntry
        fields = (
            "id",
            "employee",
            "employee_name",
            "work_date",
            "start_time",
            "end_time",
            "break_minutes",
            "employee_position",
            "hourly_rate",
            "actual_hours",
            "daily_wage",
            "employee_is_deleted",
            "employee_status",
            "work_content",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("employee_name", "created_at", "updated_at")

    employee = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        required=False,
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        instance = self.instance
        employee = attrs.get("employee", instance.employee if instance else None)
        if employee is None:
            raise serializers.ValidationError({"employee": "An employee is required."})
        employee_changed = instance is None or employee.pk != instance.employee_id
        if employee_changed and (
            employee.status != Employee.Status.ACTIVE or employee.deleted_at is not None
        ):
            raise serializers.ValidationError({"employee": "Only active employees can be scheduled."})
        start_time = attrs.get("start_time", instance.start_time if instance else None)
        end_time = attrs.get("end_time", instance.end_time if instance else None)
        work_date = attrs.get("work_date", instance.work_date if instance else None)
        if work_date is not None and work_date < employee.hire_date:
            raise serializers.ValidationError(
                {"work_date": "A shift cannot be scheduled before the employee's hire date."}
            )
        if (
            work_date is not None
            and employee.departure_date is not None
            and work_date > employee.departure_date
        ):
            raise serializers.ValidationError(
                {"work_date": "A shift cannot be scheduled after the employee's departure date."}
            )
        if start_time is not None and end_time is not None and end_time <= start_time:
            raise serializers.ValidationError({"end_time": "End time must be later than start time."})
        break_minutes = attrs.get("break_minutes", instance.break_minutes if instance else 0)
        if start_time is not None and end_time is not None:
            shift_minutes = (end_time.hour * 60 + end_time.minute) - (
                start_time.hour * 60 + start_time.minute
            )
            if break_minutes >= shift_minutes:
                raise serializers.ValidationError(
                    {"break_minutes": "Break time must be shorter than the shift."}
                )
        return attrs

    def get_actual_hours(self, instance: ScheduleEntry) -> str:
        return f"{self._actual_minutes(instance) / 60:.2f}"

    def get_daily_wage(self, instance: ScheduleEntry) -> str | None:
        if instance.employee is None:
            return None
        wage = instance.employee.hourly_rate * self._actual_minutes(instance) / 60
        return f"{wage:.2f}"

    def get_employee_is_deleted(self, instance: ScheduleEntry) -> bool:
        return instance.employee is None or instance.employee.deleted_at is not None

    @staticmethod
    def _actual_minutes(instance: ScheduleEntry) -> int:
        total = (instance.end_time.hour * 60 + instance.end_time.minute) - (
            instance.start_time.hour * 60 + instance.start_time.minute
        )
        return max(total - instance.break_minutes, 0)

    def create(self, validated_data: dict[str, Any]) -> ScheduleEntry:
        employee = validated_data["employee"]
        validated_data["employee_name"] = employee.name
        return super().create(validated_data)

    def update(self, instance: ScheduleEntry, validated_data: dict[str, Any]) -> ScheduleEntry:
        employee = validated_data.get("employee")
        if employee is not None and employee.pk != instance.employee_id:
            validated_data["employee_name"] = employee.name
        return super().update(instance, validated_data)


class ScheduleBulkDeleteSerializer(serializers.Serializer):
    schedule_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
    )
