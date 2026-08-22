from django.urls import path

from bakeops.sales.views import (
    ProfitabilityAnalysisApi,
    SalesAnalysisApi,
    SalesDataBulkDeleteApi,
    SalesDataDetailApi,
    SalesDataImportApi,
    SalesDataListApi,
    SalesRecordBulkDeleteApi,
    SalesRecordDetailApi,
    SalesRecordImportApi,
    SalesRecordListApi,
)

urlpatterns = [
    path("analysis/", SalesAnalysisApi.as_view(), name="sales-analysis"),
    path("profitability/", ProfitabilityAnalysisApi.as_view(), name="profitability-analysis"),
    path("data/", SalesDataListApi.as_view(), name="sales-data-list"),
    path("data/import/", SalesDataImportApi.as_view(), name="sales-data-import"),
    path("data/bulk-delete/", SalesDataBulkDeleteApi.as_view(), name="sales-data-bulk-delete"),
    path("data/<uuid:pk>/", SalesDataDetailApi.as_view(), name="sales-data-detail"),
    path("records/", SalesRecordListApi.as_view(), name="sales-record-list"),
    path("records/import/", SalesRecordImportApi.as_view(), name="sales-record-import"),
    path("records/bulk-delete/", SalesRecordBulkDeleteApi.as_view(), name="sales-record-bulk-delete"),
    path("records/<uuid:pk>/", SalesRecordDetailApi.as_view(), name="sales-record-detail"),
]
