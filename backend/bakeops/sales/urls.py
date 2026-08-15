from django.urls import path

from bakeops.sales.views import ProfitabilityAnalysisApi, SalesAnalysisApi

urlpatterns = [
    path("analysis/", SalesAnalysisApi.as_view(), name="sales-analysis"),
    path("profitability/", ProfitabilityAnalysisApi.as_view(), name="profitability-analysis"),
]
