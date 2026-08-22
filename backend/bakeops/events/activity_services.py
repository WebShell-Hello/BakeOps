from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from bakeops.events.models import ActivityPlan, ActivityReminderOccurrence, ActivityReminderRule


def rule_matches_date(rule: ActivityReminderRule, target: date) -> bool:
    plan = rule.plan
    if target < plan.start_date or (plan.end_date and target > plan.end_date):
        return False
    elapsed_days = (target - plan.start_date).days
    if rule.frequency == ActivityReminderRule.Frequency.ONCE:
        return target == plan.start_date
    if rule.frequency == ActivityReminderRule.Frequency.DAILY:
        return elapsed_days % rule.interval == 0
    if rule.frequency == ActivityReminderRule.Frequency.WEEKLY:
        weekdays = rule.weekdays or [plan.start_date.isoweekday()]
        start_week = plan.start_date - timedelta(days=plan.start_date.isoweekday() - 1)
        target_week = target - timedelta(days=target.isoweekday() - 1)
        return ((target_week - start_week).days // 7) % rule.interval == 0 and target.isoweekday() in weekdays
    if rule.frequency == ActivityReminderRule.Frequency.MONTHLY:
        month_days = rule.month_days or [plan.start_date.day]
        elapsed_months = (target.year - plan.start_date.year) * 12 + target.month - plan.start_date.month
        return elapsed_months % rule.interval == 0 and target.day in month_days
    return False


def scheduled_datetime(rule: ActivityReminderRule, target: date) -> datetime:
    return datetime.combine(target, rule.reminder_time, tzinfo=ZoneInfo(rule.timezone))


@transaction.atomic
def ensure_activity_occurrences(start: date, end: date) -> None:
    rules = (
        ActivityReminderRule.objects.select_related("plan")
        .filter(
            is_enabled=True,
            plan__status=ActivityPlan.Status.ACTIVE,
            plan__start_date__lte=end,
        )
        .filter(Q(plan__end_date__isnull=True) | Q(plan__end_date__gte=start))
    )
    existing = set(
        ActivityReminderOccurrence.objects.filter(
            rule__in=rules,
            scheduled_at__date__range=(start, end),
        ).values_list("rule_id", "scheduled_at")
    )
    pending: list[ActivityReminderOccurrence] = []
    for rule in rules:
        cursor = max(start, rule.plan.start_date)
        final_date = min(end, rule.plan.end_date) if rule.plan.end_date else end
        while cursor <= final_date:
            if rule_matches_date(rule, cursor):
                scheduled_at = scheduled_datetime(rule, cursor)
                if (rule.id, scheduled_at) not in existing:
                    pending.append(
                        ActivityReminderOccurrence(
                            plan=rule.plan,
                            rule=rule,
                            scheduled_at=scheduled_at,
                        )
                    )
            cursor += timedelta(days=1)
    ActivityReminderOccurrence.objects.bulk_create(pending, ignore_conflicts=True)


def occurrence_display_status(occurrence: ActivityReminderOccurrence) -> str:
    if occurrence.status != ActivityReminderOccurrence.Status.PENDING:
        return occurrence.status
    effective_time = occurrence.snoozed_until or occurrence.scheduled_at
    return "OVERDUE" if effective_time < timezone.now() else ActivityReminderOccurrence.Status.PENDING
