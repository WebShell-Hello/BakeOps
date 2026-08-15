from decimal import Decimal
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from bakeops.products.models import Ingredient, Product, Recipe, RecipeIngredient, RecipeSection


def recipe_product(
    code: str,
    name_zh: str,
    name_en: str,
    items: tuple[tuple[str, str], ...],
    notes: str = "领导提供的第一版模拟标准配方；一次生产4个可销售单位。",
    sections: tuple[tuple[str, tuple[tuple[str, str], ...]], ...] | None = None,
) -> dict[str, Any]:
    return {
        "code": code,
        "name_zh": name_zh,
        "name_en": name_en,
        "yield_quantity": 4,
        "yield_unit": "份",
        "notes": notes,
        "sections": sections or (("标准配方", items),),
    }


LEADERSHIP_PRODUCTS: tuple[dict[str, Any], ...] = (
    recipe_product("PLAIN-TOAST", "原味吐司", "Plain Toast", (("高筋面粉", "1000"), ("牛奶", "500"), ("鸡蛋", "100"), ("砂糖", "100"), ("黄油", "100"), ("酵母", "12"), ("盐", "16"))),
    recipe_product("WHOLEWHEAT-TOAST", "全麦吐司", "Whole Wheat Toast", (("全麦面粉", "700"), ("高筋面粉", "300"), ("水", "620"), ("蜂蜜", "60"), ("黄油", "60"), ("酵母", "12"), ("盐", "18"))),
    recipe_product("MILK-TOAST", "牛奶吐司", "Milk Toast", (("高筋面粉", "1000"), ("牛奶", "600"), ("淡奶油", "100"), ("鸡蛋", "100"), ("砂糖", "120"), ("黄油", "100"), ("酵母", "12"), ("盐", "16"))),
    recipe_product("RED-BEAN-TOAST", "红豆吐司", "Red Bean Toast", (("高筋面粉", "900"), ("牛奶", "480"), ("鸡蛋", "100"), ("砂糖", "90"), ("黄油", "90"), ("酵母", "11"), ("盐", "15"), ("红豆馅", "320"))),
    recipe_product("PLAIN-CROISSANT", "原味牛角包", "Plain Croissant", (("高筋面粉", "180"), ("牛奶", "60"), ("水", "35"), ("砂糖", "20"), ("黄油", "15"), ("片状黄油", "75"), ("酵母", "4"), ("盐", "3"))),
    recipe_product("CHOCOLATE-CROISSANT", "巧克力可颂", "Chocolate Croissant", (("高筋面粉", "180"), ("牛奶", "60"), ("水", "35"), ("砂糖", "20"), ("黄油", "15"), ("片状黄油", "75"), ("酵母", "4"), ("盐", "3"), ("黑巧克力", "48"))),
    recipe_product(
        "ALMOND-CROISSANT",
        "杏仁可颂",
        "Almond Croissant",
        (),
        sections=(
            ("可颂面团", (("高筋面粉", "180"), ("牛奶", "60"), ("水", "35"), ("砂糖", "20"), ("黄油", "15"), ("片状黄油", "75"), ("酵母", "4"), ("盐", "3"))),
            ("杏仁馅与装饰", (("杏仁粉", "50"), ("黄油", "35"), ("砂糖", "35"), ("鸡蛋", "30"), ("杏仁片", "20"))),
        ),
    ),
    recipe_product("CINNAMON-ROLL", "肉桂卷", "Cinnamon Roll", (("高筋面粉", "240"), ("牛奶", "120"), ("鸡蛋", "50"), ("黄油", "35"), ("砂糖", "30"), ("酵母", "5"), ("盐", "4"), ("红糖", "45"), ("肉桂粉", "6"), ("夹心黄油", "30"), ("奶油奶酪", "30"), ("糖粉", "30"))),
    recipe_product("BAGUETTE", "法棍", "Baguette", (("高筋面粉", "800"), ("水", "560"), ("盐", "16"), ("酵母", "6"))),
    recipe_product("SOURDOUGH", "酸种面包", "Sourdough Bread", (("高筋面粉", "1000"), ("水", "700"), ("酸种酵头", "200"), ("盐", "20"))),
    recipe_product("WALNUT-CRANBERRY-BREAD", "核桃蔓越莓欧包", "Walnut Cranberry Bread", (("高筋面粉", "800"), ("水", "520"), ("酸种酵头", "160"), ("核桃仁", "120"), ("蔓越莓干", "120"), ("蜂蜜", "40"), ("盐", "16"))),
    recipe_product("PINEAPPLE-BUN", "菠萝包", "Pineapple Bun", (), sections=(
        ("面包体", (("高筋面粉", "220"), ("牛奶", "100"), ("鸡蛋", "40"), ("砂糖", "30"), ("黄油", "30"), ("酵母", "4"), ("盐", "3"))),
        ("酥皮", (("低筋面粉", "80"), ("黄油", "45"), ("砂糖", "40"), ("鸡蛋", "25"))),
    )),
    recipe_product("PORK-FLOSS-BUN", "肉松面包", "Pork Floss Bun", (("高筋面粉", "220"), ("牛奶", "100"), ("鸡蛋", "40"), ("砂糖", "30"), ("黄油", "30"), ("酵母", "4"), ("盐", "3"), ("肉松", "80"), ("蛋黄酱", "40"))),
    recipe_product("RED-BEAN-BUN", "红豆面包", "Red Bean Bun", (("高筋面粉", "220"), ("牛奶", "100"), ("鸡蛋", "40"), ("砂糖", "30"), ("黄油", "30"), ("酵母", "4"), ("盐", "3"), ("红豆馅", "160"))),
    recipe_product("EGG-TART", "蛋挞", "Egg Tart", (), sections=(
        ("挞皮", (("低筋面粉", "90"), ("黄油", "60"), ("砂糖", "10"))),
        ("蛋液", (("鸡蛋", "100"), ("牛奶", "120"), ("淡奶油", "60"), ("砂糖", "35"))),
    )),
    recipe_product("SAQIMA", "萨其马", "Sachima", (("中筋面粉", "180"), ("鸡蛋", "100"), ("泡打粉", "3"), ("炸制实际耗油", "35"), ("麦芽糖", "100"), ("砂糖", "60"), ("水", "35"), ("葡萄干", "20"), ("芝麻", "10"))),
    recipe_product("ROSE-PASTRY", "鲜花饼", "Rose Pastry", (("中筋面粉", "200"), ("猪油", "70"), ("水", "70"), ("砂糖", "20"), ("玫瑰鲜花馅", "120"), ("熟芝麻", "20"))),
    recipe_product("HAM-CHEESE-SANDWICH", "火腿芝士三明治", "Ham and Cheese Sandwich", (("吐司片", "240"), ("火腿", "160"), ("切达芝士", "80"), ("生菜", "60"), ("番茄", "100"), ("蛋黄酱", "40")), "半成品先按吐司片原料记录；后续可升级为吐司半成品配方。"),
    recipe_product("CHICKEN-SALAD-SANDWICH", "鸡肉沙拉三明治", "Chicken Salad Sandwich", (("吐司片", "240"), ("熟鸡胸肉", "200"), ("生菜", "60"), ("番茄", "100"), ("黄瓜", "60"), ("蛋黄酱", "50"), ("芥末酱", "12")), "半成品先按吐司片原料记录；后续可升级为吐司半成品配方。"),
    recipe_product("CROISSANT-HAM-CHEESE-SANDWICH", "可颂火腿芝士三明治", "Croissant Ham and Cheese Sandwich", (("原味可颂", "360"), ("火腿", "160"), ("切达芝士", "80"), ("生菜", "50"), ("番茄", "80"), ("蛋黄酱", "35")), "半成品先按原味可颂原料记录；后续可升级为可颂半成品配方。"),
    recipe_product("STRAWBERRY-DANISH", "草莓丹麦", "Strawberry Danish", (("高筋面粉", "220"), ("牛奶", "80"), ("水", "40"), ("砂糖", "25"), ("黄油", "20"), ("片状黄油", "90"), ("酵母", "4"), ("盐", "4"), ("卡仕达酱", "100"), ("草莓", "120"), ("果胶", "20"))),
    recipe_product("BLUEBERRY-CHEESE-DANISH", "蓝莓奶酪丹麦", "Blueberry Cheese Danish", (("高筋面粉", "220"), ("牛奶", "80"), ("水", "40"), ("砂糖", "25"), ("黄油", "20"), ("片状黄油", "90"), ("酵母", "4"), ("盐", "4"), ("奶油奶酪", "100"), ("蓝莓", "100"), ("砂糖", "20"))),
    recipe_product("APPLE-CINNAMON-DANISH", "苹果肉桂丹麦", "Apple Cinnamon Danish", (("高筋面粉", "220"), ("牛奶", "80"), ("水", "40"), ("砂糖", "25"), ("黄油", "20"), ("片状黄油", "90"), ("酵母", "4"), ("盐", "4"), ("苹果", "180"), ("红糖", "35"), ("肉桂粉", "5"))),
    recipe_product("PUMPKIN-SPICE-BREAD", "南瓜香料面包", "Pumpkin Spice Bread", (("中筋面粉", "260"), ("南瓜泥", "180"), ("鸡蛋", "100"), ("砂糖", "90"), ("植物油", "60"), ("肉桂粉", "3"), ("姜粉", "1"), ("肉豆蔻粉", "1"), ("泡打粉", "6"), ("盐", "3"))),
    recipe_product("CHESTNUT-CROISSANT", "栗子可颂", "Chestnut Croissant", (("高筋面粉", "180"), ("牛奶", "60"), ("水", "35"), ("砂糖", "20"), ("黄油", "15"), ("片状黄油", "75"), ("酵母", "4"), ("盐", "3"), ("栗子泥", "120"), ("糖粉", "15"))),
    recipe_product("PISTACHIO-CROISSANT", "开心果可颂", "Pistachio Croissant", (("高筋面粉", "180"), ("牛奶", "60"), ("水", "35"), ("砂糖", "20"), ("黄油", "15"), ("片状黄油", "75"), ("酵母", "4"), ("盐", "3"), ("开心果酱", "100"), ("开心果碎", "25"))),
    recipe_product("EGG-YOLK-PASTRY", "蛋黄酥", "Salted Egg Yolk Pastry", (("中筋面粉", "160"), ("猪油", "60"), ("水", "60"), ("砂糖", "20"), ("红豆沙", "160"), ("咸蛋黄", "60"), ("蛋液", "20"), ("芝麻", "5"))),
    recipe_product("CUSTARD-MOONCAKE", "流心月饼", "Custard Lava Mooncake", (("中筋面粉", "120"), ("转化糖浆", "80"), ("花生油", "35"), ("枧水", "2"), ("莲蓉馅", "200"), ("流心奶黄馅", "80"), ("咸蛋黄", "60"))),
    recipe_product("CHRISTMAS-FRUIT-BREAD", "圣诞果干面包", "Christmas Fruit Bread", (("高筋面粉", "400"), ("牛奶", "180"), ("鸡蛋", "100"), ("黄油", "100"), ("砂糖", "80"), ("酵母", "6"), ("盐", "6"), ("葡萄干", "100"), ("蔓越莓干", "60"), ("糖渍橙皮", "40"), ("肉桂粉", "3"), ("肉豆蔻粉", "1"))),
    recipe_product("CHOCOLATE-STRAWBERRY-CROISSANT", "巧克力草莓可颂", "Chocolate Strawberry Croissant", (("高筋面粉", "180"), ("牛奶", "60"), ("水", "35"), ("砂糖", "20"), ("黄油", "15"), ("片状黄油", "75"), ("酵母", "4"), ("盐", "3"), ("巧克力", "60"), ("草莓", "100"), ("淡奶油", "80"))),
)


def merge_section_items(items: tuple[tuple[str, str], ...]) -> tuple[tuple[str, str], ...]:
    """Combine duplicate ingredients while preserving their first-seen order."""
    merged: dict[str, Decimal] = {}
    for ingredient_name, weight in items:
        merged[ingredient_name] = merged.get(ingredient_name, Decimal("0")) + Decimal(weight)

    return tuple(
        (ingredient_name, format(weight.normalize(), "f"))
        for ingredient_name, weight in merged.items()
    )


class Command(BaseCommand):
    help = "Create or refresh the 30 leadership-standard demo products and recipes."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        for definition in LEADERSHIP_PRODUCTS:
            product, _ = Product.objects.get_or_create(
                code=definition["code"],
                defaults={"name_zh": definition["name_zh"], "name_en": definition["name_en"]},
            )
            product.name_zh = definition["name_zh"]
            product.name_en = definition["name_en"]
            product.sale_status = Product.SaleStatus.ON_SALE
            product.notes = definition["notes"]
            product.full_clean()
            product.save()

            recipe, _ = Recipe.objects.update_or_create(
                product=product,
                version=1,
                defaults={
                    "yield_quantity": definition["yield_quantity"],
                    "yield_unit": definition["yield_unit"],
                    "is_active": True,
                },
            )
            recipe.sections.all().delete()
            for section_position, (section_name, items) in enumerate(definition["sections"]):
                section = RecipeSection.objects.create(recipe=recipe, name=section_name, position=section_position)
                for item_position, (ingredient_name, weight) in enumerate(merge_section_items(items)):
                    ingredient, _ = Ingredient.objects.get_or_create(name=ingredient_name, defaults={"base_unit": "g"})
                    RecipeIngredient.objects.create(
                        section=section,
                        ingredient=ingredient,
                        weight=weight,
                        unit="g",
                        position=item_position,
                    )
            self.stdout.write(self.style.SUCCESS(f"Seeded {product.name_zh}: 4份"))
