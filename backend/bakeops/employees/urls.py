from django.urls import path

from bakeops.employees.views import (
    EmployeeBulkDeleteApi,
    EmployeeBulkRestoreApi,
    EmployeeDetailApi,
    EmployeeListCreateApi,
    EmployeeRestoreApi,
    EmployeeScheduleHistoryApi,
)

urlpatterns = [
    path("", EmployeeListCreateApi.as_view(), name="employee-list"),
    path("bulk-delete/", EmployeeBulkDeleteApi.as_view(), name="employee-bulk-delete"),
    path("bulk-restore/", EmployeeBulkRestoreApi.as_view(), name="employee-bulk-restore"),
    path("<uuid:pk>/restore/", EmployeeRestoreApi.as_view(), name="employee-restore"),
    path("<uuid:pk>/schedule-history/", EmployeeScheduleHistoryApi.as_view(), name="employee-schedule-history"),
    path("<uuid:pk>/", EmployeeDetailApi.as_view(), name="employee-detail"),
]
