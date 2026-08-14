from django.contrib import admin

from bakeops.events.models import BusinessClosure, BusinessEvent, EventChecklistItem, Holiday


class EventChecklistInline(admin.TabularInline):  # type: ignore[type-arg]
    model = EventChecklistItem
    extra = 0


@admin.register(BusinessEvent)
class BusinessEventAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("name", "event_type", "start_date", "end_date", "expected_impact")
    list_filter = ("event_type", "expected_impact", "start_date")
    search_fields = ("name", "notes")
    inlines = (EventChecklistInline,)


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("name_en", "holiday_date", "region")
    list_filter = ("region", "holiday_date")
    search_fields = ("name_en", "name_zh")


@admin.register(BusinessClosure)
class BusinessClosureAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("name", "closure_type", "start_date", "end_date")
    list_filter = ("closure_type", "start_date")
    search_fields = ("name", "notes")
