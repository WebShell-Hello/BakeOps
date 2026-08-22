from django.urls import path

from bakeops.events.views import (
    ActivityPlanDetailApi,
    ActivityPlanListCreateApi,
    ActivityCategoryDetailApi,
    ActivityCategoryListCreateApi,
    ActivityPlanningOverviewApi,
    ActivityPlatformListCreateApi,
    ActivityPlatformDetailApi,
    ActivityReminderOccurrenceDetailApi,
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
    path("activity-planning/overview/", ActivityPlanningOverviewApi.as_view(), name="activity-planning-overview"),
    path("activity-planning/categories/", ActivityCategoryListCreateApi.as_view(), name="activity-category-list-create"),
    path("activity-planning/categories/<uuid:pk>/", ActivityCategoryDetailApi.as_view(), name="activity-category-detail"),
    path("activity-planning/platforms/", ActivityPlatformListCreateApi.as_view(), name="activity-platform-list-create"),
    path("activity-planning/platforms/<uuid:pk>/", ActivityPlatformDetailApi.as_view(), name="activity-platform-detail"),
    path("activity-planning/plans/", ActivityPlanListCreateApi.as_view(), name="activity-plan-list-create"),
    path("activity-planning/plans/<uuid:pk>/", ActivityPlanDetailApi.as_view(), name="activity-plan-detail"),
    path("activity-planning/occurrences/<uuid:pk>/", ActivityReminderOccurrenceDetailApi.as_view(), name="activity-occurrence-detail"),
    path("overview/", EventOverviewApi.as_view(), name="event-overview"),
    path("activities/", BusinessEventCreateApi.as_view(), name="business-event-create"),
    path("activities/<uuid:pk>/", BusinessEventDetailApi.as_view(), name="business-event-detail"),
    path("activities/<uuid:event_id>/checklist/", EventChecklistCreateApi.as_view(), name="event-checklist-create"),
    path("checklist/<uuid:pk>/", EventChecklistDetailApi.as_view(), name="event-checklist-detail"),
    path("closures/", BusinessClosureListCreateApi.as_view(), name="business-closure-list-create"),
    path("closures/<uuid:pk>/", BusinessClosureDetailApi.as_view(), name="business-closure-detail"),
    path("business-day-status/", BusinessDayStatusApi.as_view(), name="business-day-status"),
]
