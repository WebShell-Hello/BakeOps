from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from bakeops.products.models import Ingredient, Product, Recipe, RecipeIngredient, RecipeSection

DEMO_PRODUCTS: tuple[dict[str, Any], ...] = (
    {
        "code": "CUSTARD-BUN",
        "name_zh": "奶黄包",
        "name_en": "Custard Bun",
        "yield_quantity": 9,
        "yield_unit": "个",
        "notes": "测试配方；每批9个。当前面皮采用全脂牛奶版本，炼乳采用采购成品，预估价格待采购数据接入。",
        "production_description": """奶黄馅：
1. 绵白糖、炼乳和软化黄油搅拌均匀。
2. 低筋面粉、玉米淀粉和全脂牛奶搅拌均匀。
3. 将前两部分混合并加入蛋黄液，搅拌均匀。
4. 小火加热，持续搅拌至馅料抱团，放凉备用。

面皮与成型：
1. 中筋面粉、全脂牛奶、白砂糖和酵母混合成絮，揉成面团。
2. 盖保鲜膜进行一次发酵，至约1.5倍大。
3. 排气后揉搓约5分钟至光滑，分成9个面皮剂子。
4. 包入奶黄馅，二次醒发15–20分钟，至表面光滑且按压回弹。
5. 水开后中小火蒸15分钟，关火焖3分钟。""",
        "sections": (
            (
                "奶黄馅",
                (
                    ("鸡蛋黄", "72.000", "约4个蛋黄"),
                    ("绵白糖", "20.000", ""),
                    ("泽西全脂牛奶", "100.000", ""),
                    ("椰浆", "60.000", ""),
                    ("低筋面粉", "30.000", ""),
                    ("玉米淀粉", "30.000", ""),
                    ("雀巢炼乳", "30.000", "当前版本采用采购成品"),
                    ("黄油", "30.000", "软化"),
                ),
            ),
            (
                "面皮",
                (
                    ("中筋面粉", "280.000", ""),
                    ("泽西全脂牛奶", "155.000", "当前版本采用牛奶，不使用温水替代"),
                    ("白砂糖", "5.000", ""),
                    ("干酵母", "2.500", "混合少量温液体"),
                ),
            ),
        ),
    },
    {
        "code": "CRANBERRY-PECAN-BREAD",
        "name_zh": "蔓越莓山核桃面包",
        "name_en": "Cranberry Pecan Bread",
        "yield_quantity": 4,
        "yield_unit": "个",
        "notes": "测试配方；基础批次分4份。预估价格待采购数据接入。",
        "production_description": """预发酵面团：
1. 高筋面粉、30°C温水和干酵母混合成团，发酵约2小时。
2. 可将烤箱预热至30°C后关闭，放入一碗开水增加温度与湿度，再放入面团发酵。

主面团与加料：
1. 将全部预发酵面团加入高筋面粉、全脂牛奶、砂糖、干酵母、盐和软化黄油。
2. 搅拌至可以拉出薄膜。
3. 蔓越莓干用温水泡软15分钟，沥干后切小块。
4. 加入蔓越莓干和咸味烤山核桃，手动折叠拌匀，避免打断面筋。

整形与烘烤：
1. 发酵至约2倍大，轻擀排气，分成4份并滚圆。
2. 醒面15分钟，擀成长方形后卷起，捏紧收口，顶部斜划4刀。
3. 放一杯热水增加湿度，继续发酵至明显增大。
4. 烤箱预热至180°C，烘烤25分钟。""",
        "sections": (
            (
                "预发酵面团",
                (
                    ("高筋面粉", "100.000", ""),
                    ("水", "100.000", "约30°C温水"),
                    ("干酵母", "1.000", "混合少量温水"),
                ),
            ),
            (
                "主面团",
                (
                    ("高筋面粉", "145.000", ""),
                    ("全脂牛奶", "65.000", ""),
                    ("白砂糖", "10.000", ""),
                    ("干酵母", "2.000", "混合少量温水"),
                    ("盐", "2.000", ""),
                    ("黄油", "15.000", "软化"),
                ),
            ),
            (
                "加料",
                (
                    ("蔓越莓干", "50.000", "温水泡软15分钟后沥干切小块"),
                    ("咸味烤山核桃", "50.000", "手动折叠拌入"),
                ),
            ),
        ),
    },
    {
        "code": "STEAMED-MANTOU",
        "name_zh": "蒸馒头",
        "name_en": "Steamed Mantou",
        "yield_quantity": 10,
        "yield_unit": "个",
        "notes": (
            "初始规格采用中等馒头，每个约75g，基础配方约10个；"
            "大馒头100g、小馒头50g。原步骤中的80g分剂作为待确认记录。"
        ),
        "production_description": """1. 酵母倒入30–35°C温水搅匀，静置5分钟；表面起泡表示活化成功。
2. 中筋面粉与白砂糖拌匀，边倒酵母水边搅拌至无明显干粉的絮状。
3. 揉成团后移到案板，加入食用油，继续揉10–15分钟至表面光滑、有弹性，切面无大气孔。
4. 面团盖好，在28–30°C环境发酵约1.5–2小时至2倍大；手指蘸粉戳洞，不回缩、不塌陷即完成。
5. 轻揉均匀排气，搓长并按当前规格分成约75g剂子，逐个滚圆。
6. 放在蒸笼布或油纸上二次醒发15–20分钟，至明显变大、按压缓慢回弹。
7. 冷水入锅并留足间距，大火上汽后转中火蒸20分钟；关火焖3–5分钟后开盖。""",
        "sections": (
            (
                "面团",
                (
                    ("中筋面粉", "500.000", ""),
                    ("水", "250.000", "30–35°C温水"),
                    ("干酵母", "5.000", "先在温水中活化5分钟"),
                    ("白砂糖", "10.000", ""),
                    ("食用油", "5.000", "约5ml，揉成团后加入"),
                ),
            ),
        ),
    },
    {
        "code": "LIANGPI",
        "name_zh": "凉皮",
        "name_en": "Liangpi",
        "yield_quantity": 1,
        "yield_unit": "批",
        "notes": "初始配方未提供成品份数，暂按1批记录；豆芽、面筋和黄瓜丝未提供重量，暂不计入配方重量与成本。",
        "production_description": """1. 澄粉、中筋面粉、盐和水搅拌均匀，过筛成细腻面糊。
2. 蒸盘均匀刷薄油，倒入适量面糊。
3. 水开后上锅，大火蒸；约3秒时轻轻摇匀蒸盘中的面糊，然后盖盖继续蒸。
4. 蒸至表面鼓起大泡，约2分钟，取出蒸盘过凉水。
5. 成品可搭配豆芽、面筋和黄瓜丝；配菜重量待实际出品标准确认。""",
        "sections": (
            (
                "面糊",
                (
                    ("澄粉", "100.000", ""),
                    ("中筋面粉", "100.000", ""),
                    ("盐", "3.000", ""),
                    ("水", "320.000", ""),
                ),
            ),
        ),
    },
    {
        "code": "OSMANTHUS-LONGAN-EIGHT-TREASURE-PORRIDGE",
        "name_zh": "桂花桂圆莲子八宝粥",
        "name_en": "Osmanthus Longan Eight-Treasure Porridge",
        "yield_quantity": 12,
        "yield_unit": "碗",
        "notes": (
            "约3.5kg基础批次，暂按12碗记录，实际单碗克重待确认。"
            "红薯、山药为可选加料；英国豆类名称对照属于采购参考，不计入当前配方。"
        ),
        "production_description": """1. 大米、小米、糯米、薏米、黑米、花生、百合和去芯莲子淘洗，无需浸泡。
2. 干银耳撕成小块，与桂圆肉、去核红枣浸泡约4小时；浸泡步骤可按实际时间调整。
3. 赤小豆、花芸豆和黑豆另加一碗水，大火熬煮并持续搅拌，直至水分基本收干。
4. 将处理好的原料加入3000g清水，大火烧开后转小火煮60分钟。
5. 加入冰糖继续煮15分钟，撒桂花后关火。
6. 红薯和山药可作为可选加料，使用量待实际配方确认。""",
        "sections": (
            (
                "无需浸泡谷物与干料",
                (
                    ("大米", "25.000", "淘洗"),
                    ("小米", "30.000", "淘洗"),
                    ("糯米", "30.000", "淘洗"),
                    ("薏米", "30.000", "淘洗"),
                    ("黑米", "30.000", "淘洗"),
                    ("花生", "50.000", "淘洗"),
                    ("百合", "50.000", "淘洗"),
                    ("莲子", "40.000", "去芯后淘洗"),
                ),
            ),
            (
                "浸泡原料",
                (
                    ("干银耳", "15.000", "撕小块，浸泡约4小时可选"),
                    ("桂圆肉", "20.000", "浸泡约4小时可选"),
                    ("去核红枣", "60.000", "浸泡约4小时可选"),
                ),
            ),
            (
                "预煮豆类",
                (
                    ("赤小豆", "20.000", "另加一碗水煮至基本收干"),
                    ("花芸豆", "100.000", "另加一碗水煮至基本收干"),
                    ("黑豆", "30.000", "另加一碗水煮至基本收干"),
                ),
            ),
            (
                "熬煮",
                (
                    ("水", "3000.000", "大火烧开后小火煮60分钟"),
                    ("冰糖", "60.000", "最后加入并继续煮15分钟"),
                ),
            ),
        ),
    },
    {
        "code": "BROWN-SUGAR-GINGER-MILK-EGG-CUSTARD",
        "name_zh": "红糖姜奶鸡蛋羹",
        "name_en": "Brown Sugar Ginger Milk Egg Custard",
        "yield_quantity": 3,
        "yield_unit": "份",
        "notes": (
            "采用最终步骤中的3个鸡蛋与150ml泽西全脂牛奶版本，暂按3份记录；"
            "前文2个鸡蛋配100ml牛奶作为等比例参考。"
            "生姜汁、碧根果碎和黑芝麻未提供准确重量，暂不进入成本用量。"
        ),
        "production_description": """1. 取1–2块生姜，去皮磨成姜蓉并挤出姜汁。
2. 姜汁加入20g红糖，小火加热至完全溶解，放凉备用。
3. 三个鸡蛋打匀，加入冷却的红糖姜汁和150ml泽西全脂牛奶，搅拌均匀。
4. 容器顶部用锡纸封好，蒸笼上汽后蒸15分钟，关火焖5分钟。
5. 出锅后可撒烤碧根果碎和少量黑芝麻；装饰用量待标准化。""",
        "sections": (
            (
                "蛋奶液",
                (
                    ("鸡蛋", "150.000", "约3个rich yolk large鸡蛋，重量暂按每个50g估算"),
                    ("泽西全脂牛奶", "150.000", "约150ml"),
                    ("红糖", "20.000", "与姜汁小火加热溶解后冷却"),
                    ("生姜", "20.000", "1–2块的临时估算重量，实际称重后更新"),
                ),
            ),
        ),
    },
    {
        "code": "HU-LA-TANG",
        "name_zh": "胡辣汤",
        "name_en": "Hu La Tang",
        "yield_quantity": 18,
        "yield_unit": "碗",
        "notes": (
            "18碗测试批次，后续等比例缩量。当前采用90g核心香料粉＋6L水；"
            "清单另写6桶1.5L即9L，存在冲突，待实际试做确认。"
            "虫草花仅记录约50根但无重量，暂不计成本；粉条、豆腐丝和葱花为可选探索项。"
        ),
        "production_description": """前置准备：
1. 干木耳泡发后切丝；黄花菜泡发后切小段。
2. 牛肉加入葱、姜、八角和香叶，高压约25分钟，放凉后切小片。

熬煮：
1. 6000g水烧开，加入牛油和核心混合香料粉。
2. 加入木耳丝、黄花菜，再次烧开。
3. 加入卤好切片的牛肉和面筋丁。
4. 加入盐和味精；家庭版本可减少味精或取消。
5. 无筋淀粉加水调匀，分三次倒入锅中并持续搅拌至合适稠度。
6. 后续试做可探索加入粉条、豆腐丝和葱花；核心香料粉成分与配比仍待研发。""",
        "sections": (
            (
                "汤底",
                (
                    ("水", "6000.000", "采用90g香料粉配6L水版本；与清单9L记录冲突待确认"),
                    ("牛油", "160.000", "可减量或去掉"),
                    ("胡辣汤核心混合香料粉", "90.000", "成分及配比待探索"),
                    ("盐", "60.000", "可减量"),
                    ("味精", "75.000", "家庭版本可减量或取消"),
                ),
            ),
            (
                "配料",
                (
                    ("干木耳", "100.000", "泡发后切丝"),
                    ("干黄花菜", "100.000", "泡发后切小段"),
                    ("卤牛肉", "1000.000", "高压约25分钟后切小片"),
                    ("面筋丁", "500.000", ""),
                ),
            ),
            (
                "勾芡",
                (
                    ("无筋淀粉", "500.000", "加水调匀后分三次倒入"),
                ),
            ),
        ),
    },
)


class Command(BaseCommand):
    help = "Create or refresh the curated BakeOps demo products and their recipes."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        for definition in DEMO_PRODUCTS:
            product = Product.objects.filter(code=definition["code"]).first()
            if product is None:
                product = Product.objects.filter(name_zh=definition["name_zh"]).first()
            if product is None:
                product = Product(code=definition["code"])
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
                    "production_description": definition["production_description"],
                    "is_active": True,
                },
            )
            recipe.sections.all().delete()
            for section_position, (section_name, items) in enumerate(definition["sections"]):
                section = RecipeSection.objects.create(
                    recipe=recipe,
                    name=section_name,
                    position=section_position,
                )
                for item_position, (ingredient_name, weight, preparation_note) in enumerate(items):
                    ingredient, _ = Ingredient.objects.get_or_create(name=ingredient_name, defaults={"base_unit": "g"})
                    RecipeIngredient.objects.create(
                        section=section,
                        ingredient=ingredient,
                        weight=weight,
                        unit="g",
                        estimated_price=None,
                        position=item_position,
                        preparation_note=preparation_note,
                    )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Seeded {product.name_zh}: {recipe.total_weight}g / {recipe.yield_quantity}{recipe.yield_unit}"
                )
            )
