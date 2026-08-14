from datetime import date
from decimal import Decimal
from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from bakeops.events.models import BusinessClosure, BusinessEvent, EventChecklistItem, Holiday
from bakeops.events.serializers import DEFAULT_CHECKLIST
from bakeops.products.models import Product

HOLIDAYS = (
    ("UK-EW-2026-NEW-YEAR", "元旦", "New Year's Day", date(2026, 1, 1), "Bank holiday"),
    ("COMMERCIAL-2026-VALENTINE", "情人节", "Valentine's Day", date(2026, 2, 14), "Commercial date"),
    ("COMMERCIAL-2026-MOTHERS", "母亲节", "Mother's Day", date(2026, 3, 15), "Commercial date"),
    ("UK-EW-2026-GOOD-FRIDAY", "耶稣受难日", "Good Friday", date(2026, 4, 3), "Bank holiday"),
    ("UK-EW-2026-EASTER-MONDAY", "复活节星期一", "Easter Monday", date(2026, 4, 6), "Bank holiday"),
    ("UK-EW-2026-EARLY-MAY", "五月初银行假日", "Early May bank holiday", date(2026, 5, 4), "Bank holiday"),
    ("UK-EW-2026-SPRING", "春季银行假日", "Spring bank holiday", date(2026, 5, 25), "Bank holiday"),
    ("UK-EW-2026-SUMMER", "夏季银行假日", "Summer bank holiday", date(2026, 8, 31), "Bank holiday"),
    ("COMMERCIAL-2026-HALLOWEEN", "万圣节", "Halloween", date(2026, 10, 31), "Commercial date"),
    ("UK-EW-2026-CHRISTMAS", "圣诞节", "Christmas Day", date(2026, 12, 25), "Bank holiday"),
    ("UK-EW-2026-BOXING", "节礼日补休日", "Boxing Day substitute day", date(2026, 12, 28), "Bank holiday"),
)

EVENTS = (
    {
        "name": "网红探店合作",
        "event_type": "KOL_COLLABORATION",
        "start_date": date(2026, 8, 20),
        "end_date": date(2026, 8, 20),
        "preparation_days": 14,
        "expected_impact": "HIGH",
        "expected_sales_change": Decimal("30"),
        "estimated_cost": Decimal("500"),
        "notes": "邀请本地美食博主到店拍摄，重点展示招牌产品。",
        "product_indexes": (0, 1, 2),
        "completed_items": 8,
    },
    {
        "name": "老客户回馈周",
        "event_type": "CUSTOMER_LOYALTY",
        "start_date": date(2026, 9, 1),
        "end_date": date(2026, 9, 7),
        "preparation_days": 21,
        "expected_impact": "MEDIUM",
        "expected_sales_change": Decimal("20"),
        "estimated_cost": Decimal("300"),
        "notes": "面向常客推出限定组合与积分奖励。",
        "product_indexes": (0, 3),
        "completed_items": 0,
        "holiday_code": "UK-EW-2026-SUMMER",
    },
    {
        "name": "买二送一",
        "event_type": "PROMOTION",
        "start_date": date(2026, 9, 10),
        "end_date": date(2026, 9, 12),
        "preparation_days": 14,
        "expected_impact": "HIGH",
        "expected_sales_change": Decimal("25"),
        "estimated_cost": Decimal("450"),
        "notes": "指定烘焙产品买二送一。",
        "product_indexes": (1, 2),
        "completed_items": 0,
    },
    {
        "name": "秋季新品发布",
        "event_type": "PRODUCT_LAUNCH",
        "start_date": date(2026, 10, 3),
        "end_date": date(2026, 10, 4),
        "preparation_days": 21,
        "expected_impact": "MEDIUM",
        "expected_sales_change": Decimal("18"),
        "estimated_cost": Decimal("650"),
        "notes": "秋季限定产品首发。",
        "product_indexes": (3, 4),
        "completed_items": 0,
    },
    {
        "name": "门店周年庆",
        "event_type": "MEMBER_EVENT",
        "start_date": date(2026, 12, 5),
        "end_date": date(2026, 12, 6),
        "preparation_days": 30,
        "expected_impact": "HIGH",
        "expected_sales_change": Decimal("40"),
        "estimated_cost": Decimal("1200"),
        "notes": "周年限定产品、会员赠礼与线下互动。",
        "product_indexes": (0, 1, 2, 3),
        "completed_items": 0,
    },
)


class Command(BaseCommand):
    help = "Create or refresh 2026 holidays, business events and closure examples."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        if not Product.objects.filter(recipes__is_active=True).exists():
            call_command("seed_demo_products")
        products = list(Product.objects.filter(recipes__is_active=True).distinct().order_by("code")[:5])
        holidays: dict[str, Holiday] = {}
        for code, name_zh, name_en, holiday_date, notes in HOLIDAYS:
            holiday, _ = Holiday.objects.update_or_create(
                code=code,
                defaults={
                    "name_zh": name_zh,
                    "name_en": name_en,
                    "holiday_date": holiday_date,
                    "notes": notes,
                },
            )
            holidays[code] = holiday

        for definition in EVENTS:
            holiday_code = definition.get("holiday_code")
            event, _ = BusinessEvent.objects.update_or_create(
                name=definition["name"],
                start_date=definition["start_date"],
                defaults={
                    "event_type": definition["event_type"],
                    "end_date": definition["end_date"],
                    "preparation_days": definition["preparation_days"],
                    "expected_impact": definition["expected_impact"],
                    "expected_sales_change": definition["expected_sales_change"],
                    "estimated_cost": definition["estimated_cost"],
                    "notes": definition["notes"],
                    "linked_holiday": holidays.get(holiday_code) if holiday_code else None,
                },
            )
            event.focus_products.set(
                products[index] for index in definition["product_indexes"] if index < len(products)
            )
            if not event.checklist_items.exists():
                positions: dict[str, int] = {}
                items = []
                for category, title_zh, title_en in DEFAULT_CHECKLIST:
                    position = positions.get(category, 0)
                    items.append(
                        EventChecklistItem(
                            event=event,
                            category=category,
                            title_zh=title_zh,
                            title_en=title_en,
                            position=position,
                        )
                    )
                    positions[category] = position + 1
                EventChecklistItem.objects.bulk_create(items)
            completed_items = definition["completed_items"]
            checklist = list(event.checklist_items.all())
            for index, item in enumerate(checklist):
                should_complete = index < completed_items
                if item.is_completed != should_complete:
                    item.is_completed = should_complete
                    item.save(update_fields=("is_completed", "updated_at"))

        BusinessClosure.objects.update_or_create(
            name="设备年度维护",
            start_date=date(2026, 8, 24),
            defaults={
                "closure_type": BusinessClosure.ClosureType.MAINTENANCE,
                "end_date": date(2026, 8, 24),
                "notes": "烤箱与制冷设备年度维护，门店暂停营业一天。",
            },
        )
        BusinessClosure.objects.update_or_create(
            name="节礼日休息",
            start_date=date(2026, 12, 26),
            defaults={
                "closure_type": BusinessClosure.ClosureType.REST_DAY,
                "end_date": date(2026, 12, 26),
                "notes": "门店休息。",
            },
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {Holiday.objects.filter(holiday_date__year=2026).count()} holidays, "
                f"{BusinessEvent.objects.count()} events and {BusinessClosure.objects.count()} closures."
            )
        )
