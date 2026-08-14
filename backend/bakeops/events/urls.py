from django.urls import path

from bakeops.events.views import (
    BusinessClosureDetailApi,
    BusinessClosureListCreateApi,
    BusinessDayStatusApi,
    BusinessEventCreateApi,
    BusinessEventDetailApi,
    EventChecklistCreateApi,
    EventChecklistDetailApi,
    EventOverviewApi,
)

urlpatterns = [
    path("overview/", EventOverviewApi.as_view(), name="event-overview"),
    path("activities/", BusinessEventCreateApi.as_view(), name="business-event-create"),
    path("activities/<uuid:pk>/", BusinessEventDetailApi.as_view(), name="business-event-detail"),
    path("activities/<uuid:event_id>/checklist/", EventChecklistCreateApi.as_view(), name="event-checklist-create"),
    path("checklist/<uuid:pk>/", EventChecklistDetailApi.as_view(), name="event-checklist-detail"),
    path("closures/", BusinessClosureListCreateApi.as_view(), name="business-closure-list-create"),
    path("closures/<uuid:pk>/", BusinessClosureDetailApi.as_view(), name="business-closure-detail"),
    path("business-day-status/", BusinessDayStatusApi.as_view(), name="business-day-status"),
]
