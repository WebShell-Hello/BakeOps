from django.urls import path

from bakeops.inventory.views import (
    InventoryOverviewApi,
    InventoryReceiptBulkDeleteApi,
    InventoryReceiptCreateApi,
    InventoryReceiptDetailApi,
    InventoryReceiptInvoiceApi,
    InventoryReceiptRecorderOptionsApi,
    ProductionPlanDetailApi,
    ProductionPlanListCreateApi,
    PurchaseRequestCreateApi,
)

urlpatterns = [
    path("overview/", InventoryOverviewApi.as_view(), name="inventory-overview"),
    path("purchase-requests/", PurchaseRequestCreateApi.as_view(), name="inventory-purchase-request-create"),
    path("receipts/", InventoryReceiptCreateApi.as_view(), name="inventory-receipt-create"),
    path(
        "receipts/bulk-delete/",
        InventoryReceiptBulkDeleteApi.as_view(),
        name="inventory-receipt-bulk-delete",
    ),
    path(
        "receipts/recorder-options/",
        InventoryReceiptRecorderOptionsApi.as_view(),
        name="inventory-receipt-recorder-options",
    ),
    path("receipts/<uuid:pk>/", InventoryReceiptDetailApi.as_view(), name="inventory-receipt-detail"),
    path("receipts/<uuid:pk>/invoice/", InventoryReceiptInvoiceApi.as_view(), name="inventory-receipt-invoice"),
    path("production-plans/", ProductionPlanListCreateApi.as_view(), name="production-plan-list-create"),
    path("production-plans/<uuid:pk>/", ProductionPlanDetailApi.as_view(), name="production-plan-detail"),
]
