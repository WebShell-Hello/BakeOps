from django.urls import path

from bakeops.system.views import ProductionBackupApi

urlpatterns = [
    path("production-backup/", ProductionBackupApi.as_view(), name="system-production-backup"),
]
