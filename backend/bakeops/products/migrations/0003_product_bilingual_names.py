from django.db import migrations, models


ENGLISH_NAMES_BY_CODE = {
    "CUSTARD-BUN": "Custard Bun",
    "CRANBERRY-PECAN-BREAD": "Cranberry Pecan Bread",
}


def populate_english_names(apps, schema_editor):
    product_model = apps.get_model("products", "Product")
    used_names: set[str] = set()
    for product in product_model.objects.order_by("created_at", "id"):
        base_name = ENGLISH_NAMES_BY_CODE.get(product.code)
        if not base_name:
            base_name = product.name_zh
        candidate = base_name
        suffix = 2
        while candidate in used_names:
            candidate = f"{base_name} {suffix}"
            suffix += 1
        product.name_en = candidate
        product.save(update_fields=("name_en",))
        used_names.add(candidate)


class Migration(migrations.Migration):
    dependencies = [("products", "0002_alter_product_options")]

    operations = [
        migrations.RenameField(
            model_name="product",
            old_name="name",
            new_name="name_zh",
        ),
        migrations.AddField(
            model_name="product",
            name="name_en",
            field=models.CharField(max_length=120, null=True),
        ),
        migrations.RunPython(populate_english_names, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="product",
            name="name_en",
            field=models.CharField(max_length=120, unique=True),
        ),
        migrations.AlterModelOptions(
            name="product",
            options={
                "ordering": ("name_zh", "name_en"),
                "permissions": (("manage_products", "Can manage products and recipes"),),
            },
        ),
        migrations.AlterModelOptions(
            name="recipe",
            options={"ordering": ("product__name_zh", "-version")},
        ),
    ]
