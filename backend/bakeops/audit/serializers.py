from typing import Any

from rest_framework import serializers

from bakeops.audit.models import AccessLog, AuditLog
from bakeops.navigation.models import NavigationItem

ACTION_LABELS = {
    "PAGE_VIEW": ("查看页面", "View page"),
    "API_READ": ("查看数据", "View data"),
    "API_REQUEST": ("提交操作", "Submit operation"),
    "CREATE": ("新增", "Create"),
    "UPDATE": ("修改", "Update"),
    "DELETE": ("删除", "Delete"),
    "LOGIN": ("登录", "Sign in"),
    "LOGOUT": ("退出登录", "Sign out"),
    "LOGIN_FAILED": ("登录失败", "Sign-in failed"),
    "PERMISSION_DENIED": ("权限拒绝", "Access denied"),
    "EXPORT": ("导出", "Export"),
    "UPLOAD": ("上传", "Upload"),
    "DOWNLOAD": ("下载", "Download"),
    "OTHER": ("其他操作", "Other operation"),
}

RESOURCE_LABELS = {
    "dashboard": ("仪表盘", "Dashboard"),
    "access": ("角色权限", "Roles & Permissions"),
    "navigation": ("菜单管理", "Menu Management"),
    "users": ("用户管理", "User Management"),
    "costs": ("成本管理", "Cost Management"),
    "employees": ("员工", "Staff"),
    "schedules": ("考勤", "Attendance"),
    "events": ("日历与活动", "Calendar & Events"),
    "products": ("产品与配方", "Product & Recipe"),
    "inventory": ("库存", "Inventory"),
    "production-plans": ("生产计划", "Production Plans"),
    "sales": ("销售分析", "Sales Analysis"),
    "suppliers": ("采购与供应商", "Purchases & Suppliers"),
}


def route_parts(path: str) -> list[str]:
    return [part for part in path.strip("/").split("/") if part]


def resolved_menu(path: str, page_key: str) -> NavigationItem | None:
    if page_key:
        item = (
            NavigationItem.objects.filter(key=page_key, item_type=NavigationItem.ItemType.PAGE)
            .select_related("parent")
            .first()
        )
        if item:
            return item
    parts = route_parts(path)
    if parts[:2] == ["api", "v1"]:
        api_to_page = {
            "dashboard": "dashboard",
            "access": "settings.roles-permissions",
            "navigation": "settings.menu-management",
            "users": "settings.users",
            "costs": "analytics.costs",
            "employees": "people.staff",
            "schedules": "people.attendance",
            "events": "planning.calendar-events",
            "products": "products.recipes",
            "sales": "analytics.sales",
            "suppliers": "operations.purchases",
            "inventory": "operations.inventory",
        }
        page_key = api_to_page.get(parts[2], "") if len(parts) > 2 else ""
        if parts[2:4] == ["inventory", "production-plans"]:
            page_key = "planning.production"
        if parts[2:4] == ["inventory", "receipts"]:
            page_key = "operations.inventory-receipts"
        if parts[2:4] == ["sales", "records"]:
            page_key = "operations.sales"
        if parts[2:4] == ["sales", "data"]:
            page_key = "operations.sales"
        if page_key:
            return (
                NavigationItem.objects.filter(key=page_key, item_type=NavigationItem.ItemType.PAGE)
                .select_related("parent")
                .first()
            )
    return (
        NavigationItem.objects.filter(frontend_path=path, item_type=NavigationItem.ItemType.PAGE)
        .select_related("parent")
        .first()
    )


def action_labels(action: str, method: str, path: str, resource_id: str) -> tuple[str, str]:
    if action in {"API_READ", "API_REQUEST"}:
        if method in {"GET", "HEAD"}:
            if path.rstrip("/").endswith("overview"):
                return ("查看概览", "View overview")
            if resource_id:
                return ("查看详情", "View details")
            return ("查看列表", "View list")
        return {
            "POST": ACTION_LABELS["CREATE"],
            "PUT": ACTION_LABELS["UPDATE"],
            "PATCH": ACTION_LABELS["UPDATE"],
            "DELETE": ACTION_LABELS["DELETE"],
        }.get(method, ACTION_LABELS["OTHER"])
    return ACTION_LABELS.get(action, ACTION_LABELS["OTHER"])


class LogDisplayMixin:
    def to_representation(self, instance: Any) -> dict[str, Any]:
        data = serializers.ModelSerializer.to_representation(self, instance)  # type: ignore[arg-type]
        menu = resolved_menu(instance.path, instance.page_key)
        action_zh, action_en = action_labels(instance.action, instance.method, instance.path, instance.resource_id)
        resource_parts = route_parts(instance.path)
        module_key = (
            resource_parts[2]
            if len(resource_parts) > 2 and resource_parts[:2] == ["api", "v1"]
            else instance.resource_type
        )
        endpoint_key = resource_parts[3] if len(resource_parts) > 3 else ""
        resource_key = endpoint_key if endpoint_key in RESOURCE_LABELS else module_key
        resource_zh, resource_en = RESOURCE_LABELS.get(resource_key, (instance.resource_type, instance.resource_type))
        data.update(
            {
                "menu_key": menu.key if menu else "",
                "menu_name_zh": menu.label_zh if menu else resource_zh,
                "menu_name_en": menu.label_en if menu else resource_en,
                "action_label_zh": action_zh,
                "action_label_en": action_en,
                "resource_label_zh": resource_zh,
                "resource_label_en": resource_en,
            }
        )
        return data


class AccessLogSerializer(LogDisplayMixin, serializers.ModelSerializer[AccessLog]):
    user_name = serializers.CharField(source="user.username", read_only=True, default="")
    user_email = serializers.CharField(source="user.email", read_only=True, default="")

    class Meta:
        model = AccessLog
        fields = (
            "id",
            "created_at",
            "system_mode",
            "actor_type",
            "user_id",
            "user_name",
            "user_email",
            "visitor_id",
            "method",
            "path",
            "page_key",
            "resource_type",
            "resource_id",
            "action",
            "status_code",
            "success",
            "duration_ms",
            "ip_hash",
            "country_code",
            "region",
            "city",
            "device_type",
            "os_family",
            "os_version",
            "browser_family",
            "browser_version",
            "user_agent",
            "metadata",
        )


class AuditLogSerializer(LogDisplayMixin, serializers.ModelSerializer[AuditLog]):
    user_name = serializers.CharField(source="user.username", read_only=True, default="")
    user_email = serializers.CharField(source="user.email", read_only=True, default="")

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "created_at",
            "system_mode",
            "actor_type",
            "user_id",
            "user_name",
            "user_email",
            "visitor_id",
            "method",
            "path",
            "resource_type",
            "resource_id",
            "action",
            "status_code",
            "success",
            "reason",
            "changed_fields",
            "ip_hash",
            "country_code",
            "region",
            "city",
            "device_type",
            "os_family",
            "os_version",
            "browser_family",
            "browser_version",
            "user_agent",
            "metadata",
        )
