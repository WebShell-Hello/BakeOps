from django.urls import path

from bakeops.sales.views import SalesAnalysisApi

urlpatterns = [
    path("analysis/", SalesAnalysisApi.as_view(), name="sales-analysis"),
]
