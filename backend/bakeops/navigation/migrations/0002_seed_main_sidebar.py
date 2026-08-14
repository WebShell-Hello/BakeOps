from django.db import migrations


MENU_ITEMS = [
    {
        "key": "dashboard",
        "item_type": "PAGE",
        "label_zh": "仪表盘",
        "label_en": "Dashboard",
        "icon_key": "LayoutDashboard",
        "frontend_path": "/",
        "position": 0,
    },
    {
        "key": "analytics",
        "item_type": "CATEGORY",
        "label_zh": "数据分析",
        "label_en": "Analytics",
        "icon_key": "BarChart3",
        "position": 100,
        "children": [
            ("analytics.sales", "销售分析", "Sales Analysis", "/analytics/sales"),
            ("analytics.profitability", "盈利分析", "Profitability", "/analytics/profitability"),
            ("analytics.product-performance", "产品表现", "Product Performance", "/analytics/product-performance"),
            ("analytics.waste", "损耗分析", "Waste Analysis", "/analytics/waste"),
            ("analytics.labour", "人力分析", "Labour Analysis", "/analytics/labour"),
            ("analytics.marketing", "营销分析", "Marketing Analysis", "/analytics/marketing"),
            ("analytics.events", "活动分析", "Event Analysis", "/analytics/events"),
        ],
    },
    {
        "key": "planning",
        "item_type": "CATEGORY",
        "label_zh": "计划管理",
        "label_en": "Planning",
        "icon_key": "CalendarRange",
        "position": 200,
        "children": [
            ("planning.production", "生产计划", "Production Planning", "/planning/production"),
            ("planning.calendar-events", "日历与活动", "Calendar & Events", "/planning/calendar-events"),
            ("planning.marketing", "市场营销", "Marketing", "/planning/marketing"),
        ],
    },
    {
        "key": "operations",
        "item_type": "CATEGORY",
        "label_zh": "运营管理",
        "label_en": "Operations",
        "icon_key": "BriefcaseBusiness",
        "position": 300,
        "children": [
            ("operations.sales", "销售", "Sales", "/operations/sales"),
            ("operations.production", "生产", "Production", "/operations/production"),
            ("operations.inventory", "库存", "Inventory", "/operations/inventory"),
            ("operations.purchases", "采购与供应商", "Purchases & Suppliers", "/operations/purchases-suppliers"),
            ("operations.waste", "损耗", "Waste", "/operations/waste"),
        ],
    },
    {
        "key": "products",
        "item_type": "CATEGORY",
        "label_zh": "产品管理",
        "label_en": "Products",
        "icon_key": "Package",
        "position": 400,
        "children": [
            ("products.recipes", "产品与配方", "Product & Recipe", "/products/product-recipes"),
        ],
    },
    {
        "key": "people",
        "item_type": "CATEGORY",
        "label_zh": "人员管理",
        "label_en": "People",
        "icon_key": "UsersRound",
        "position": 500,
        "children": [
            ("people.staff", "员工", "Staff", "/people/staff"),
            ("people.attendance", "考勤", "Attendance", "/people/attendance"),
        ],
    },
    {
        "key": "settings",
        "item_type": "CATEGORY",
        "label_zh": "系统设置",
        "label_en": "Settings",
        "icon_key": "Settings",
        "position": 600,
        "children": [
            ("settings.users", "用户管理", "User Management", "/settings/users"),
            ("settings.roles-permissions", "角色权限", "Roles & Permissions", "/settings/roles-permissions"),
            ("settings.menu-management", "菜单管理", "Menu Management", "/settings/menu-management"),
        ],
    },
]


def seed_main_sidebar(apps, schema_editor):
    NavigationMenu = apps.get_model("navigation", "NavigationMenu")
    NavigationItem = apps.get_model("navigation", "NavigationItem")

    menu, _ = NavigationMenu.objects.get_or_create(
        code="main-sidebar",
        defaults={
            "name_zh": "主侧边栏",
            "name_en": "Main Sidebar",
            "description": "BakeOps primary application navigation",
        },
    )

    for definition in MENU_ITEMS:
        children = definition.get("children", [])
        parent = NavigationItem.objects.create(
            menu=menu,
            key=definition["key"],
            item_type=definition["item_type"],
            label_zh=definition["label_zh"],
            label_en=definition["label_en"],
            icon_key=definition["icon_key"],
            frontend_path=definition.get("frontend_path"),
            position=definition["position"],
        )
        for position, (key, label_zh, label_en, frontend_path) in enumerate(children):
            NavigationItem.objects.create(
                menu=menu,
                parent=parent,
                key=key,
                item_type="PAGE",
                label_zh=label_zh,
                label_en=label_en,
                frontend_path=frontend_path,
                position=position,
            )


def unseed_main_sidebar(apps, schema_editor):
    NavigationMenu = apps.get_model("navigation", "NavigationMenu")
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    menu = NavigationMenu.objects.filter(code="main-sidebar").first()
    if menu is not None:
        NavigationItem.objects.filter(menu=menu, parent__isnull=False).delete()
        NavigationItem.objects.filter(menu=menu).delete()
        menu.delete()


class Migration(migrations.Migration):
    dependencies = [("navigation", "0001_initial")]

    operations = [migrations.RunPython(seed_main_sidebar, unseed_main_sidebar)]
