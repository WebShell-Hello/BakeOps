from django.urls import path

from bakeops.inventory.views import (
    InventoryOverviewApi,
    InventoryReceiptCreateApi,
    ProductionPlanDetailApi,
    ProductionPlanListCreateApi,
    PurchaseRequestCreateApi,
)

urlpatterns = [
    path("overview/", InventoryOverviewApi.as_view(), name="inventory-overview"),
    path("purchase-requests/", PurchaseRequestCreateApi.as_view(), name="inventory-purchase-request-create"),
    path("receipts/", InventoryReceiptCreateApi.as_view(), name="inventory-receipt-create"),
    path("production-plans/", ProductionPlanListCreateApi.as_view(), name="production-plan-list-create"),
    path("production-plans/<uuid:pk>/", ProductionPlanDetailApi.as_view(), name="production-plan-detail"),
]
