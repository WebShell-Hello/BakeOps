from django.contrib import admin

from bakeops.employees.models import Employee


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = (
        "employee_number",
        "name",
        "position",
        "hire_date",
        "departure_date",
        "employment_type",
        "hourly_rate",
        "status",
        "deleted_at",
    )
    list_filter = ("status", "employment_type", "gender", "deleted_at")
    search_fields = ("employee_number", "name", "email", "position")
