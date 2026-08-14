from decimal import Decimal
from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from bakeops.products.models import Ingredient, RecipeIngredient
from bakeops.suppliers.models import Supplier, SupplierIngredient

DEMO_SUPPLIERS: tuple[dict[str, Any], ...] = (
    {
        "code": "SUP-LONDON-FLOUR",
        "name": "London Flour Collective",
        "address": "18 Bermondsey Trading Estate, London SE16",
        "contact_name": "Amelia Reed",
        "phone": "07111 200101",
        "email": "orders@londonflour.example",
        "notes": "面粉品类齐全，周一和周四配送。",
        "items": (
            ("高筋面粉", "1.28", "kg", "25", "kg", 5, "100kg以上可议价"),
            ("中筋面粉", "1.16", "kg", "25", "kg", 5, "常规蒸点用粉"),
            ("低筋面粉", "1.34", "kg", "20", "kg", 5, "蛋糕及奶黄馅用"),
        ),
    },
    {
        "code": "SUP-KENT-MILLING",
        "name": "Kent Milling & Starches",
        "address": "Unit 7 Medway Food Park, Rochester, Kent ME2",
        "contact_name": "Oliver Grant",
        "phone": "07111 200102",
        "email": "trade@kentmilling.example",
        "notes": "淀粉类大宗采购价格稳定。",
        "items": (
            ("澄粉", "2.10", "kg", "10", "kg", 7, "整箱采购"),
            ("无筋淀粉", "1.72", "kg", "20", "kg", 7, "适合勾芡"),
            ("玉米淀粉", "1.48", "kg", "20", "kg", 7, "食品级袋装"),
        ),
    },
    {
        "code": "SUP-THAMES-DAIRY",
        "name": "Thames Valley Dairy",
        "address": "42 Dairy Lane, Reading RG2",
        "contact_name": "Sophie Turner",
        "phone": "07111 200103",
        "email": "bakery@thamesdairy.example",
        "notes": "冷链配送，需提前确认收货时间。",
        "items": (
            ("全脂牛奶", "1.18", "litre", "24", "litre", 3, "整箱配送"),
            ("泽西全脂牛奶", "1.72", "litre", "12", "litre", 4, "每周两次到货"),
            ("黄油", "5.80", "kg", "10", "kg", 7, "多买优惠"),
        ),
    },
    {
        "code": "SUP-MEADOW-EGGS",
        "name": "Meadow Lane Eggs",
        "address": "Meadow Lane Farm, Guildford GU3",
        "contact_name": "Henry Wells",
        "phone": "07111 200104",
        "email": "sales@meadoweggs.example",
        "notes": "鸡蛋按托供应，可提供分离蛋黄。",
        "items": (
            ("鸡蛋", "0.24", "each", "180", "each", 3, "大号鸡蛋"),
            ("鸡蛋黄", "8.90", "kg", "5", "kg", 5, "冷藏蛋黄液"),
        ),
    },
    {
        "code": "SUP-SWEET-PANTRY",
        "name": "Sweet Pantry Wholesale",
        "address": "9 Sugar House Road, London E16",
        "contact_name": "Maya Collins",
        "phone": "07111 200105",
        "email": "orders@sweetpantry.example",
        "notes": "糖类常备库存，适合日常补货。",
        "items": (
            ("白砂糖", "0.92", "kg", "25", "kg", 3, "标准食品级"),
            ("绵白糖", "1.08", "kg", "25", "kg", 3, "细颗粒"),
            ("红糖", "1.55", "kg", "10", "kg", 3, "深色软红糖"),
        ),
    },
    {
        "code": "SUP-GOLDEN-IMPORTS",
        "name": "Golden Bridge Imports",
        "address": "27 Dockside Way, Tilbury RM18",
        "contact_name": "Emily Zhao",
        "phone": "07111 200106",
        "email": "trade@goldenbridge.example",
        "notes": "亚洲食品进口，整箱价格较低。",
        "items": (
            ("冰糖", "1.80", "kg", "10", "kg", 7, "黄冰糖可选"),
            ("雀巢炼乳", "2.35", "tin", "24", "tin", 7, "397g罐装"),
            ("椰浆", "1.45", "tin", "24", "tin", 7, "400ml罐装"),
        ),
    },
    {
        "code": "SUP-BAKE-ESSENTIALS",
        "name": "Bakehouse Essentials UK",
        "address": "Unit 12 Park Royal, London NW10",
        "contact_name": "Jack Morgan",
        "phone": "07111 200107",
        "email": "service@bakehouseessentials.example",
        "notes": "烘焙基础耗材，可与面粉订单合并配送。",
        "items": (
            ("干酵母", "6.40", "kg", "5", "kg", 5, "真空包装"),
            ("盐", "0.58", "kg", "25", "kg", 3, "细盐"),
            ("食用油", "1.95", "litre", "20", "litre", 3, "菜籽油"),
        ),
    },
    {
        "code": "SUP-ORCHARD-DRIED",
        "name": "Orchard Dried Foods",
        "address": "6 Market Yard, Oxford OX2",
        "contact_name": "Lucy Hall",
        "phone": "07111 200108",
        "email": "wholesale@orcharddried.example",
        "notes": "果干批次差异需到货检查。",
        "items": (
            ("蔓越莓干", "6.20", "kg", "5", "kg", 5, "低糖版本可预订"),
            ("去核红枣", "4.60", "kg", "5", "kg", 7, "去核散装"),
            ("桂圆肉", "8.80", "kg", "3", "kg", 7, "无核桂圆肉"),
        ),
    },
    {
        "code": "SUP-NUT-GROVE",
        "name": "Nut Grove Foods",
        "address": "11 Grove Estate, Cambridge CB4",
        "contact_name": "Noah Bennett",
        "phone": "07111 200109",
        "email": "orders@nutgrove.example",
        "notes": "坚果需密封储存，批量订单提前一周。",
        "items": (
            ("咸味烤山核桃", "12.90", "kg", "5", "kg", 7, "轻盐烘烤"),
            ("花生", "2.40", "kg", "10", "kg", 5, "去皮花生可选"),
        ),
    },
    {
        "code": "SUP-HARVEST-GRAINS",
        "name": "Harvest Grain Merchants",
        "address": "3 Mill Road, St Albans AL1",
        "contact_name": "Grace Patel",
        "phone": "07111 200110",
        "email": "trade@harvestgrain.example",
        "notes": "米类可按月锁价。",
        "items": (
            ("大米", "1.42", "kg", "25", "kg", 5, "长粒米"),
            ("小米", "2.35", "kg", "10", "kg", 5, "去壳小米"),
            ("糯米", "2.10", "kg", "20", "kg", 5, "圆糯米"),
        ),
    },
    {
        "code": "SUP-WHOLEGRAIN",
        "name": "Wholegrain Storehouse",
        "address": "88 Fen Road, Ely CB7",
        "contact_name": "Daniel Cooper",
        "phone": "07111 200111",
        "email": "sales@wholegrainstorehouse.example",
        "notes": "杂粮适合季度采购。",
        "items": (
            ("薏米", "3.25", "kg", "10", "kg", 7, "整粒薏米"),
            ("黑米", "2.85", "kg", "10", "kg", 7, "当季新米"),
            ("黑豆", "2.55", "kg", "10", "kg", 7, "干豆"),
        ),
    },
    {
        "code": "SUP-BEAN-BASKET",
        "name": "Bean Basket Trading",
        "address": "14 Wholesale Avenue, Birmingham B6",
        "contact_name": "Ava Singh",
        "phone": "07111 200112",
        "email": "orders@beanbasket.example",
        "notes": "豆类和莲子可混装达到 MOQ。",
        "items": (
            ("赤小豆", "2.70", "kg", "10", "kg", 7, "红小豆"),
            ("花芸豆", "2.95", "kg", "10", "kg", 7, "大颗粒"),
            ("莲子", "7.20", "kg", "5", "kg", 10, "去芯莲子"),
        ),
    },
    {
        "code": "SUP-BOTANICAL-PANTRY",
        "name": "Botanical Pantry Ltd",
        "address": "31 Herbal Lane, Bristol BS2",
        "contact_name": "Isla Green",
        "phone": "07111 200113",
        "email": "trade@botanicalpantry.example",
        "notes": "干货到货后需检查含水率。",
        "items": (
            ("百合", "9.40", "kg", "3", "kg", 10, "干百合"),
            ("干银耳", "11.50", "kg", "2", "kg", 10, "整朵银耳"),
            ("干木耳", "8.60", "kg", "3", "kg", 10, "无根木耳"),
        ),
    },
    {
        "code": "SUP-EAST-ASIA-PRODUCE",
        "name": "East Asia Produce",
        "address": "5 New Spitalfields Market, London E10",
        "contact_name": "Leo Chen",
        "phone": "07111 200114",
        "email": "market@eastasiaproduce.example",
        "notes": "可随蔬菜订单配送，价格随市场变化。",
        "items": (("干黄花菜", "7.80", "kg", "3", "kg", 7, "无硫处理"), ("生姜", "2.65", "kg", "5", "kg", 2, "鲜姜")),
    },
    {
        "code": "SUP-SPICE-WORKS",
        "name": "London Spice Works",
        "address": "73 Commercial Street, London E1",
        "contact_name": "Ethan Khan",
        "phone": "07111 200115",
        "email": "blend@londonspiceworks.example",
        "notes": "支持定制香料配方，定制批次需确认样品。",
        "items": (
            ("胡辣汤核心混合香料粉", "14.50", "kg", "5", "kg", 14, "配方确认后生产"),
            ("味精", "2.20", "kg", "10", "kg", 5, "食品级"),
        ),
    },
    {
        "code": "SUP-CITY-BUTCHERS",
        "name": "City Butchers Wholesale",
        "address": "22 Smithfield Market, London EC1",
        "contact_name": "Arthur King",
        "phone": "07111 200116",
        "email": "bakery@citybutchers.example",
        "notes": "肉类冷链配送，周末订单需提前。",
        "items": (
            ("卤牛肉", "10.80", "kg", "10", "kg", 5, "可按要求切块"),
            ("牛油", "4.20", "kg", "5", "kg", 5, "精炼牛油"),
        ),
    },
    {
        "code": "SUP-WHEAT-FOODS",
        "name": "Wheat & Gluten Foods",
        "address": "16 Canal Industrial Park, Leicester LE3",
        "contact_name": "Freya Scott",
        "phone": "07111 200117",
        "email": "orders@wheatgluten.example",
        "notes": "面筋制品按冷藏运输。",
        "items": (
            ("面筋丁", "4.90", "kg", "10", "kg", 5, "预切小丁"),
            ("澄粉", "2.18", "kg", "10", "kg", 5, "与面筋订单合并"),
        ),
    },
    {
        "code": "SUP-KITCHEN-ESSENTIALS",
        "name": "Kitchen Essentials Direct",
        "address": "4 Depot Close, Watford WD18",
        "contact_name": "Oscar Young",
        "phone": "07111 200118",
        "email": "trade@kitchenessentials.example",
        "notes": "临时补货供应商，当日截单次日配送。",
        "items": (
            ("水", "0.18", "litre", "48", "litre", 1, "瓶装水，仅作应急"),
            ("盐", "0.66", "kg", "10", "kg", 1, "小批量补货"),
        ),
    },
    {
        "code": "SUP-BAKERS-BULK",
        "name": "Bakers Bulk Depot",
        "address": "55 North Circular Estate, London N18",
        "contact_name": "Chloe Adams",
        "phone": "07111 200119",
        "email": "bulk@bakersdepot.example",
        "notes": "大宗采购便宜，需要叉车卸货。",
        "items": (
            ("高筋面粉", "1.20", "kg", "100", "kg", 7, "100kg起订"),
            ("白砂糖", "0.86", "kg", "100", "kg", 7, "整托价格"),
            ("黄油", "5.55", "kg", "25", "kg", 7, "冷藏整箱"),
        ),
    },
    {
        "code": "SUP-CANTON-FOODS",
        "name": "Canton Foods UK",
        "address": "10 Oriental Food Centre, London NW2",
        "contact_name": "Ruby Wong",
        "phone": "07111 200120",
        "email": "wholesale@cantonfoods.example",
        "notes": "亚洲罐头与淀粉补充供应商。",
        "items": (
            ("椰浆", "1.38", "tin", "48", "tin", 10, "整箱优惠"),
            ("雀巢炼乳", "2.28", "tin", "48", "tin", 10, "整箱优惠"),
            ("玉米淀粉", "1.55", "kg", "10", "kg", 7, "小包装可选"),
        ),
    },
)

PREFERRED_SUPPLIERS = {
    "高筋面粉": "SUP-BAKERS-BULK",
    "澄粉": "SUP-KENT-MILLING",
    "玉米淀粉": "SUP-KENT-MILLING",
    "黄油": "SUP-BAKERS-BULK",
    "白砂糖": "SUP-BAKERS-BULK",
    "盐": "SUP-BAKE-ESSENTIALS",
    "椰浆": "SUP-CANTON-FOODS",
    "雀巢炼乳": "SUP-CANTON-FOODS",
}

TARGET_SUPPLIER_COUNT = 50


def extra_supplier_price(ingredient_name: str, index: int) -> Decimal:
    name = ingredient_name.lower()
    if any(token in name for token in ("面粉", "淀粉", "粉")):
        return Decimal("1.20") + Decimal(index % 5) * Decimal("0.11")
    if any(token in name for token in ("黄油", "奶油", "芝士", "奶酪")):
        return Decimal("4.80") + Decimal(index % 5) * Decimal("0.28")
    if any(token in name for token in ("鸡蛋", "蛋黄", "蛋液")):
        return Decimal("0.22") + Decimal(index % 4) * Decimal("0.03")
    if any(token in name for token in ("坚果", "杏仁", "核桃", "开心果", "栗子")):
        return Decimal("6.80") + Decimal(index % 6) * Decimal("0.65")
    if any(token in name for token in ("草莓", "蓝莓", "苹果", "番茄", "黄瓜", "生菜")):
        return Decimal("2.20") + Decimal(index % 6) * Decimal("0.35")
    return Decimal("1.50") + Decimal(index % 7) * Decimal("0.24")


def extra_supplier_definitions(recipe_ingredient_names: list[str]) -> tuple[dict[str, Any], ...]:
    extra_count = max(TARGET_SUPPLIER_COUNT - len(DEMO_SUPPLIERS), 0)
    groups: list[list[str]] = [[] for _ in range(extra_count)]
    if extra_count and recipe_ingredient_names:
        for index in range(extra_count):
            groups[index].append(recipe_ingredient_names[index % len(recipe_ingredient_names)])
        for index, ingredient_name in enumerate(recipe_ingredient_names[extra_count:]):
            groups[index % extra_count].append(ingredient_name)

    definitions: list[dict[str, Any]] = []
    for supplier_index, ingredient_names in enumerate(groups, start=1):
        items = tuple(
            (
                ingredient_name,
                str(extra_supplier_price(ingredient_name, supplier_index)),
                "kg",
                "5",
                "kg",
                2 + supplier_index % 9,
                "基于当前产品配方的模拟供应条款",
            )
            for ingredient_name in ingredient_names
        )
        definitions.append(
            {
                "code": f"SUP-BAKEOPS-{supplier_index:03d}",
                "name": f"BakeOps Local Supplier {supplier_index:02d}",
                "address": f"{supplier_index + 20} Market Road, London",
                "contact_name": f"BakeOps Contact {supplier_index:02d}",
                "phone": f"07200 {300000 + supplier_index:06d}",
                "email": f"orders{supplier_index:02d}@bakeops-supplier.example",
                "notes": "根据当前产品配方生成的模拟供应商。",
                "items": items,
            }
        )
    return tuple(definitions)


class Command(BaseCommand):
    help = "Create or refresh 50 demo suppliers using ingredients from the current product recipes."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        if not RecipeIngredient.objects.filter(section__recipe__is_active=True).exists():
            call_command("seed_demo_products")
        call_command("seed_leadership_products")
        recipe_names = list(
            RecipeIngredient.objects.filter(section__recipe__is_active=True)
            .values_list("ingredient__name", flat=True)
            .distinct()
            .order_by("ingredient__name")
        )
        if not recipe_names:
            raise CommandError("Supplier demo data requires active product recipes. Run the product seed command first.")

        definitions = DEMO_SUPPLIERS + extra_supplier_definitions(recipe_names)
        required_names = {item[0] for supplier in definitions for item in supplier["items"]}
        ingredients = Ingredient.objects.in_bulk(required_names, field_name="name")
        missing_names = sorted(required_names - set(ingredients))
        if missing_names:
            raise CommandError("Missing supplier ingredients in the product data: " + ", ".join(missing_names))
        SupplierIngredient.objects.filter(ingredient__name__in=required_names).update(is_preferred=False)

        for definition in definitions:
            supplier, _ = Supplier.objects.update_or_create(
                code=definition["code"],
                defaults={
                    "name": definition["name"],
                    "address": definition["address"],
                    "contact_name": definition["contact_name"],
                    "phone": definition["phone"],
                    "email": definition["email"],
                    "notes": definition["notes"],
                },
            )
            supplied_names = {item[0] for item in definition["items"]}
            supplier.supplied_ingredients.exclude(ingredient__name__in=supplied_names).delete()
            for ingredient_name, price, price_unit, moq, moq_unit, lead_days, notes in definition["items"]:
                SupplierIngredient.objects.update_or_create(
                    supplier=supplier,
                    ingredient=ingredients[ingredient_name],
                    defaults={
                        "unit_price": Decimal(price),
                        "currency": "GBP",
                        "price_unit": price_unit,
                        "minimum_order_quantity": Decimal(moq),
                        "minimum_order_unit": moq_unit,
                        "lead_time_days": lead_days,
                        "notes": notes,
                        "is_active": True,
                        "is_preferred": PREFERRED_SUPPLIERS.get(ingredient_name) == supplier.code,
                    },
                )
            self.stdout.write(self.style.SUCCESS(f"Seeded {supplier.name}: {len(definition['items'])} ingredients"))
