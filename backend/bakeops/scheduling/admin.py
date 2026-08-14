from django.contrib import admin

from bakeops.scheduling.models import ScheduleEntry


@admin.register(ScheduleEntry)
class ScheduleEntryAdmin(admin.ModelAdmin):
    list_display = (
        "employee_name",
        "work_date",
        "start_time",
        "end_time",
        "break_minutes",
        "work_content",
    )
    list_filter = ("work_date",)
    search_fields = ("employee_name", "work_content")
