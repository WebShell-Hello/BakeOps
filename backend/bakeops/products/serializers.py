import uuid
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import serializers

from bakeops.products.costing import current_estimated_cost
from bakeops.products.models import Ingredient, Product, Recipe, RecipeIngredient, RecipeSection

MIN_RECIPE_WEIGHT = Decimal("0.001")
MAX_RECIPE_WEIGHT = Decimal("9999999.999")
RECIPE_WEIGHT_QUANTUM = Decimal("0.001")


class RecipeIngredientSerializer(serializers.ModelSerializer[RecipeIngredient]):
    ingredient_id = serializers.UUIDField(source="ingredient.id", read_only=True)
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    section_id = serializers.UUIDField(read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)

    class Meta:
        model = RecipeIngredient
        fields = (
            "id",
            "section_id",
            "section_name",
            "ingredient_id",
            "ingredient_name",
            "weight",
            "unit",
            "estimated_price",
            "preparation_note",
            "position",
        )


class RecipeSectionSerializer(serializers.ModelSerializer[RecipeSection]):
    items = RecipeIngredientSerializer(many=True, read_only=True)

    class Meta:
        model = RecipeSection
        fields = ("id", "name", "position", "items")


class ProductSerializer(serializers.ModelSerializer[Product]):
    yield_quantity = serializers.IntegerField(write_only=True, min_value=1, required=False)
    yield_unit = serializers.CharField(write_only=True, max_length=24, required=False)
    production_description = serializers.CharField(write_only=True, allow_blank=True, required=False)
    active_recipe = serializers.SerializerMethodField(read_only=True)
    current_estimated_cost = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "code",
            "name_zh",
            "name_en",
            "sale_status",
            "notes",
            "yield_quantity",
            "yield_unit",
            "production_description",
            "active_recipe",
            "current_estimated_cost",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("code", "created_at", "updated_at")

    def get_active_recipe(self, instance: Product) -> dict[str, Any] | None:
        recipe = next((item for item in instance.recipes.all() if item.is_active), None)
        if recipe is None:
            return None
        return {
            "id": str(recipe.id),
            "version": recipe.version,
            "yield_quantity": recipe.yield_quantity,
            "yield_unit": recipe.yield_unit,
            "production_description": recipe.production_description,
            "total_weight": format(recipe.total_weight, "f"),
            "sections": RecipeSectionSerializer(recipe.sections.all(), many=True).data,
        }

    def get_current_estimated_cost(self, instance: Product) -> dict[str, object] | None:
        recipe = next((item for item in instance.recipes.all() if item.is_active), None)
        return current_estimated_cost(recipe) if recipe is not None else None

    @transaction.atomic
    def create(self, validated_data: dict[str, Any]) -> Product:
        recipe_data = self._pop_recipe_data(validated_data)
        product = Product.objects.create(code=f"PROD-{uuid.uuid4().hex[:10].upper()}", **validated_data)
        recipe = Recipe.objects.create(product=product, version=1, is_active=True, **recipe_data)
        RecipeSection.objects.create(recipe=recipe, name="配方", position=0)
        return product

    @transaction.atomic
    def update(self, instance: Product, validated_data: dict[str, Any]) -> Product:
        recipe_data = self._pop_recipe_data(validated_data, include_only_present=True)
        for attribute, value in validated_data.items():
            setattr(instance, attribute, value)
        instance.full_clean()
        instance.save()
        recipe = instance.recipes.select_for_update().filter(is_active=True).first()
        if recipe is None:
            recipe = Recipe.objects.create(product=instance, version=1, is_active=True)
        next_yield_quantity = recipe_data.get("yield_quantity", recipe.yield_quantity)
        if next_yield_quantity != recipe.yield_quantity:
            self._scale_ingredient_weights(recipe, recipe.yield_quantity, next_yield_quantity)
        for attribute, value in recipe_data.items():
            setattr(recipe, attribute, value)
        recipe.full_clean()
        recipe.save()
        instance._prefetched_objects_cache = {}
        return instance

    @staticmethod
    def _scale_ingredient_weights(recipe: Recipe, previous_quantity: int, next_quantity: int) -> None:
        ratio = Decimal(next_quantity) / Decimal(previous_quantity)
        items = list(RecipeIngredient.objects.select_for_update().filter(section__recipe=recipe))
        updated_at = timezone.now()
        for item in items:
            scaled_weight = (item.weight * ratio).quantize(
                RECIPE_WEIGHT_QUANTUM,
                rounding=ROUND_HALF_UP,
            )
            if scaled_weight < MIN_RECIPE_WEIGHT or scaled_weight > MAX_RECIPE_WEIGHT:
                raise serializers.ValidationError(
                    {
                        "yield_quantity": (
                            "The new recipe yield would produce an ingredient weight outside the supported range."
                        )
                    }
                )
            item.weight = scaled_weight
            item.updated_at = updated_at

        if items:
            RecipeIngredient.objects.bulk_update(items, ("weight", "updated_at"))

    def _pop_recipe_data(self, validated_data: dict[str, Any], include_only_present: bool = False) -> dict[str, Any]:
        defaults: dict[str, Any] = {
            "yield_quantity": 1,
            "yield_unit": "个",
            "production_description": "",
        }
        recipe_data: dict[str, Any] = {}
        for field, default in defaults.items():
            if field in validated_data:
                recipe_data[field] = validated_data.pop(field)
            elif not include_only_present:
                recipe_data[field] = default
        return recipe_data


class RecipeIngredientWriteSerializer(serializers.Serializer[dict[str, Any]]):
    ingredient_name = serializers.CharField(max_length=120)
    section_name = serializers.CharField(max_length=100)
    weight = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0.001"))
    unit = serializers.CharField(max_length=16, default="g")
    preparation_note = serializers.CharField(max_length=255, allow_blank=True, required=False, default="")

    def validate_ingredient_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Ingredient name is required.")
        return value

    def validate_section_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Section name is required.")
        return value

    @transaction.atomic
    def create(self, validated_data: dict[str, Any]) -> RecipeIngredient:
        recipe: Recipe = self.context["recipe"]
        section = self._get_or_create_section(recipe, validated_data.pop("section_name"))
        ingredient = self._get_or_create_ingredient(validated_data.pop("ingredient_name"), validated_data["unit"])
        if RecipeIngredient.objects.filter(section=section, ingredient=ingredient).exists():
            raise serializers.ValidationError({"ingredient_name": "This ingredient already exists in the section."})
        maximum_position = section.items.aggregate(maximum=Max("position"))["maximum"]
        position = 0 if maximum_position is None else maximum_position + 1
        return RecipeIngredient.objects.create(
            section=section,
            ingredient=ingredient,
            position=position,
            estimated_price=None,
            **validated_data,
        )

    @transaction.atomic
    def update(self, instance: RecipeIngredient, validated_data: dict[str, Any]) -> RecipeIngredient:
        old_section = instance.section
        section = self._get_or_create_section(old_section.recipe, validated_data.pop("section_name"))
        ingredient = self._get_or_create_ingredient(validated_data.pop("ingredient_name"), validated_data["unit"])
        duplicate = RecipeIngredient.objects.filter(section=section, ingredient=ingredient).exclude(pk=instance.pk)
        if duplicate.exists():
            raise serializers.ValidationError({"ingredient_name": "This ingredient already exists in the section."})
        if section.pk != old_section.pk:
            maximum_position = section.items.aggregate(maximum=Max("position"))["maximum"]
            instance.position = 0 if maximum_position is None else maximum_position + 1
            instance.section = section
        instance.ingredient = ingredient
        for attribute, value in validated_data.items():
            setattr(instance, attribute, value)
        instance.full_clean()
        instance.save()
        if old_section.pk != section.pk and not old_section.items.exists():
            old_section.delete()
        return instance

    @staticmethod
    def _get_or_create_section(recipe: Recipe, name: str) -> RecipeSection:
        existing = recipe.sections.filter(name=name).first()
        if existing is not None:
            return existing
        maximum_position = recipe.sections.aggregate(maximum=Max("position"))["maximum"]
        position = 0 if maximum_position is None else maximum_position + 1
        return RecipeSection.objects.create(recipe=recipe, name=name, position=position)

    @staticmethod
    def _get_or_create_ingredient(name: str, unit: str) -> Ingredient:
        ingredient, _ = Ingredient.objects.get_or_create(name=name, defaults={"base_unit": unit})
        return ingredient
