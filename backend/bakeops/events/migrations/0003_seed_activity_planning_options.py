from django.db import migrations


CATEGORIES = (
    ("SOCIAL_MEDIA", "社交媒体", "Social Media", "violet", "MessagesSquare", 10),
    ("DELIVERY_PLATFORM", "外卖平台", "Delivery Platform", "orange", "Bike", 20),
    ("IN_STORE_PROMOTION", "现场宣传", "In-store Promotion", "blue", "PanelTop", 30),
    ("INFLUENCER", "网红合作", "Influencer Collaboration", "rose", "UserRoundCheck", 40),
    ("MEMBER_MARKETING", "会员运营", "Member Marketing", "green", "UsersRound", 50),
    ("COMMUNITY", "社区合作", "Community Partnership", "cyan", "Handshake", 60),
    ("OTHER", "其他", "Other", "zinc", "Shapes", 70),
)

PLATFORMS = (
    ("SOCIAL_MEDIA", "INSTAGRAM", "Instagram", "Instagram", 10),
    ("SOCIAL_MEDIA", "XIAOHONGSHU", "小红书", "Xiaohongshu", 20),
    ("SOCIAL_MEDIA", "TIKTOK", "TikTok", "TikTok", 30),
    ("DELIVERY_PLATFORM", "DELIVEROO", "Deliveroo", "Deliveroo", 10),
    ("DELIVERY_PLATFORM", "HUNGRYPANDA", "HungryPanda", "HungryPanda", 20),
    ("DELIVERY_PLATFORM", "UBER_EATS", "Uber Eats", "Uber Eats", 30),
    ("IN_STORE_PROMOTION", "STORE_POSTER", "门店海报", "Store Poster", 10),
    ("IN_STORE_PROMOTION", "FLYER", "传单", "Flyer", 20),
    ("IN_STORE_PROMOTION", "WINDOW_DISPLAY", "橱窗展示", "Window Display", 30),
    ("INFLUENCER", "KOL_ENDORSEMENT", "网红代言", "Influencer Endorsement", 10),
    ("INFLUENCER", "STORE_VISIT", "探店合作", "Store Visit Collaboration", 20),
    ("MEMBER_MARKETING", "MEMBER_MESSAGE", "会员消息", "Member Message", 10),
    ("MEMBER_MARKETING", "EMAIL", "电子邮件", "Email", 20),
    ("COMMUNITY", "LOCAL_PARTNERSHIP", "本地合作", "Local Partnership", 10),
    ("OTHER", "OTHER", "其他", "Other", 10),
)


def seed_options(apps, schema_editor):
    Category = apps.get_model("events", "ActivityCategory")
    Platform = apps.get_model("events", "ActivityPlatform")
    categories = {}
    for code, name_zh, name_en, colour, icon_key, position in CATEGORIES:
        category, _ = Category.objects.update_or_create(
            code=code,
            defaults={
                "name_zh": name_zh,
                "name_en": name_en,
                "colour": colour,
                "icon_key": icon_key,
                "position": position,
                "is_active": True,
            },
        )
        categories[code] = category
    for category_code, code, name_zh, name_en, position in PLATFORMS:
        Platform.objects.update_or_create(
            code=code,
            defaults={
                "category": categories[category_code],
                "name_zh": name_zh,
                "name_en": name_en,
                "position": position,
                "is_active": True,
            },
        )


def remove_options(apps, schema_editor):
    Platform = apps.get_model("events", "ActivityPlatform")
    Category = apps.get_model("events", "ActivityCategory")
    Platform.objects.filter(code__in=[row[1] for row in PLATFORMS]).delete()
    Category.objects.filter(code__in=[row[0] for row in CATEGORIES]).delete()


class Migration(migrations.Migration):
    dependencies = [("events", "0002_activitycategory_activityplatform_activityplan_and_more")]
    operations = [migrations.RunPython(seed_options, remove_options)]
