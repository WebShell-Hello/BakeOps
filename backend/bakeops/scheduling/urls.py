from django.urls import path

from bakeops.scheduling.views import (
    ActiveScheduleEmployeeListApi,
    ScheduleBulkDeleteApi,
    ScheduleEntryDetailApi,
    ScheduleEntryListCreateApi,
)

urlpatterns = [
    path("employee-options/", ActiveScheduleEmployeeListApi.as_view(), name="schedule-employee-options"),
    path("bulk-delete/", ScheduleBulkDeleteApi.as_view(), name="schedule-bulk-delete"),
    path("", ScheduleEntryListCreateApi.as_view(), name="schedule-entry-list"),
    path("<uuid:pk>/", ScheduleEntryDetailApi.as_view(), name="schedule-entry-detail"),
]
