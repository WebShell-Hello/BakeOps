from django.urls import path

from bakeops.audit.views import AccessLogListApi, AuditLogListApi, ClientActionLogApi, PageViewLogApi

urlpatterns = [
    path("access/", AccessLogListApi.as_view(), name="audit-access-list"),
    path("audit/", AuditLogListApi.as_view(), name="audit-audit-list"),
    path("page-views/", PageViewLogApi.as_view(), name="audit-page-view"),
    path("client-actions/", ClientActionLogApi.as_view(), name="audit-client-action"),
]
