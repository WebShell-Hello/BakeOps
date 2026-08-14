import uuid
from typing import Any

from django.db import transaction
from rest_framework import serializers

from bakeops.products.models import Ingredient
from bakeops.suppliers.models import Supplier, SupplierIngredient


class IngredientOptionSerializer(serializers.ModelSerializer[Ingredient]):
    class Meta:
        model = Ingredient
        fields = ("id", "name", "base_unit")


class SupplierIngredientSerializer(serializers.ModelSerializer[SupplierIngredient]):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    ingredient_base_unit = serializers.CharField(source="ingredient.base_unit", read_only=True)

    class Meta:
        model = SupplierIngredient
        fields = (
            "id",
            "ingredient",
            "ingredient_name",
            "ingredient_base_unit",
            "unit_price",
            "currency",
            "price_unit",
            "minimum_order_quantity",
            "minimum_order_unit",
            "lead_time_days",
            "notes",
            "is_active",
            "is_preferred",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "ingredient_name",
            "ingredient_base_unit",
            "created_at",
            "updated_at",
        )

    def validate_currency(self, value: str) -> str:
        value = value.strip().upper()
        if len(value) != 3 or not value.isalpha():
            raise serializers.ValidationError("Currency must be a three-letter ISO code.")
        return value

    def validate_price_unit(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Price unit is required.")
        return value

    def validate_minimum_order_unit(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Minimum order unit is required.")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        supplier = self.context.get("supplier")
        if self.instance is not None:
            supplier = self.instance.supplier
        ingredient = attrs.get("ingredient", getattr(self.instance, "ingredient", None))
        is_active = attrs.get("is_active", getattr(self.instance, "is_active", True))
        requested_preferred = attrs.get("is_preferred")
        if supplier is None:
            raise serializers.ValidationError({"supplier": "Supplier context is required."})
        if ingredient is not None and not ingredient.is_active:
            raise serializers.ValidationError({"ingredient": "Inactive ingredients cannot be supplied."})
        if requested_preferred is True and not is_active:
            raise serializers.ValidationError({"is_preferred": "A preferred supply option must be active."})
        if not is_active:
            attrs["is_preferred"] = False

        existing = SupplierIngredient.objects.filter(supplier=supplier, ingredient=ingredient)
        if self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)
        if ingredient is not None and existing.exists():
            raise serializers.ValidationError({"ingredient": "This ingredient is already configured for the supplier."})
        return attrs

    @transaction.atomic
    def create(self, validated_data: dict[str, Any]) -> SupplierIngredient:
        supplier = self.context["supplier"]
        if validated_data.get("is_preferred"):
            self._clear_existing_preference(validated_data["ingredient"])
        return SupplierIngredient.objects.create(supplier=supplier, **validated_data)

    @transaction.atomic
    def update(
        self,
        instance: SupplierIngredient,
        validated_data: dict[str, Any],
    ) -> SupplierIngredient:
        next_ingredient = validated_data.get("ingredient", instance.ingredient)
        next_preferred = validated_data.get("is_preferred", instance.is_preferred)
        next_active = validated_data.get("is_active", instance.is_active)
        if not next_active:
            validated_data["is_preferred"] = False
            next_preferred = False
        if next_preferred:
            self._clear_existing_preference(next_ingredient, exclude=instance.pk)
        return super().update(instance, validated_data)

    @staticmethod
    def _clear_existing_preference(ingredient: Ingredient, exclude: uuid.UUID | None = None) -> None:
        queryset = SupplierIngredient.objects.select_for_update().filter(
            ingredient=ingredient,
            is_preferred=True,
        )
        if exclude is not None:
            queryset = queryset.exclude(pk=exclude)
        queryset.update(is_preferred=False)


class SupplierSerializer(serializers.ModelSerializer[Supplier]):
    supplied_ingredients = SupplierIngredientSerializer(many=True, read_only=True)
    supplied_ingredient_count = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = (
            "id",
            "code",
            "name",
            "address",
            "contact_name",
            "phone",
            "email",
            "notes",
            "supplied_ingredient_count",
            "supplied_ingredients",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("code", "supplied_ingredient_count", "supplied_ingredients", "created_at", "updated_at")

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Supplier name is required.")
        queryset = Supplier.objects.filter(name__iexact=value)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A supplier with this name already exists.")
        return value

    def validate_phone(self, value: str) -> str:
        return value.strip()

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def create(self, validated_data: dict[str, Any]) -> Supplier:
        return Supplier.objects.create(code=f"SUP-{uuid.uuid4().hex[:10].upper()}", **validated_data)

    def get_supplied_ingredient_count(self, instance: Supplier) -> int:
        return sum(item.is_active for item in instance.supplied_ingredients.all())
