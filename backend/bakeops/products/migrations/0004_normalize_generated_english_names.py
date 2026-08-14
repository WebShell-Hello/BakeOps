from django.db import migrations


def replace_code_derived_names(apps, schema_editor):
    product_model = apps.get_model("products", "Product")
    used_names = set(product_model.objects.values_list("name_en", flat=True))
    for product in product_model.objects.all():
        generated_name = product.code.replace("-", " ").title()
        if product.name_en == generated_name:
            used_names.discard(product.name_en)
            candidate = product.name_zh
            suffix = 2
            while candidate in used_names:
                candidate = f"{product.name_zh} {suffix}"
                suffix += 1
            product.name_en = candidate
            product.save(update_fields=("name_en",))
            used_names.add(candidate)


class Migration(migrations.Migration):
    dependencies = [("products", "0003_product_bilingual_names")]

    operations = [
        migrations.RunPython(replace_code_derived_names, migrations.RunPython.noop),
    ]
