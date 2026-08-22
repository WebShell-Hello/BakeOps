from django.urls import include, path

from bakeops.api.views import DashboardOverviewApi, HealthCheckApi

urlpatterns = [
    path("health/", HealthCheckApi.as_view(), name="health"),
    path("dashboard/overview/", DashboardOverviewApi.as_view(), name="dashboard-overview"),
    path("access/", include("bakeops.access.urls")),
    path("audit/", include("bakeops.audit.urls")),
    path("costs/", include("bakeops.costs.urls")),
    path("navigation/", include("bakeops.navigation.urls")),
    path("employees/", include("bakeops.employees.urls")),
    path("events/", include("bakeops.events.urls")),
    path("products/", include("bakeops.products.urls")),
    path("inventory/", include("bakeops.inventory.urls")),
    path("schedules/", include("bakeops.scheduling.urls")),
    path("sales/", include("bakeops.sales.urls")),
    path("suppliers/", include("bakeops.suppliers.urls")),
    path("users/", include("bakeops.users.urls")),
]
