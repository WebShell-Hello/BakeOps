from django.urls import path

from bakeops.costs.views import (
    CostItemDetailApi,
    CostItemListCreateApi,
    CostOverviewApi,
    MaterialDetailApi,
    MonthlyCostBatchUpdateApi,
    MonthlyCostDetailApi,
    MonthlyCostListCreateApi,
    WageDetailApi,
)

urlpatterns = [
    path("overview/", CostOverviewApi.as_view(), name="cost-overview"),
    path("wage-details/", WageDetailApi.as_view(), name="cost-wage-details"),
    path("material-details/", MaterialDetailApi.as_view(), name="cost-material-details"),
    path("monthly-items/", MonthlyCostBatchUpdateApi.as_view(), name="monthly-cost-batch-update"),
    path("items/", CostItemListCreateApi.as_view(), name="cost-item-list-create"),
    path("items/<uuid:pk>/", CostItemDetailApi.as_view(), name="cost-item-detail"),
    path("monthly/", MonthlyCostListCreateApi.as_view(), name="monthly-cost-list-create"),
    path("monthly/<uuid:pk>/", MonthlyCostDetailApi.as_view(), name="monthly-cost-detail"),
]
