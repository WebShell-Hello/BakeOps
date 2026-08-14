from rest_framework import serializers

from bakeops.employees.models import Employee


class EmployeeSerializer(serializers.ModelSerializer[Employee]):
    class Meta:
        model = Employee
        fields = (
            "id",
            "employee_number",
            "name",
            "gender",
            "date_of_birth",
            "hire_date",
            "departure_date",
            "position",
            "hourly_rate",
            "employment_type",
            "email",
            "status",
            "deleted_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("deleted_at", "created_at", "updated_at")

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Employee name is required.")
        return value

    def validate_employee_number(self, value: str) -> str:
        value = value.strip()
        if not value.isdigit():
            raise serializers.ValidationError("Employee number must contain digits only.")
        return value

    def validate(self, attrs):
        instance = self.instance
        date_of_birth = attrs.get(
            "date_of_birth", instance.date_of_birth if instance else None
        )
        hire_date = attrs.get("hire_date", instance.hire_date if instance else None)
        departure_date = attrs.get(
            "departure_date", instance.departure_date if instance else None
        )
        status = attrs.get("status", instance.status if instance else Employee.Status.ACTIVE)

        if date_of_birth and hire_date and hire_date <= date_of_birth:
            raise serializers.ValidationError(
                {"hire_date": "Hire date must be later than date of birth."}
            )
        if departure_date and hire_date and departure_date < hire_date:
            raise serializers.ValidationError(
                {"departure_date": "Departure date cannot be earlier than hire date."}
            )
        if status == Employee.Status.DEPARTED and departure_date is None:
            raise serializers.ValidationError(
                {"departure_date": "Departure date is required for departed employees."}
            )
        if status != Employee.Status.DEPARTED and departure_date is not None:
            raise serializers.ValidationError(
                {"departure_date": "Departure date is only valid for departed employees."}
            )
        return attrs


class EmployeeBulkActionSerializer(serializers.Serializer):
    employee_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
    )
