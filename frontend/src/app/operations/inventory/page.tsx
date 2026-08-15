import { InventoryManagementPage } from "@/components/inventory/inventory-management-page";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ ingredient?: string | string[] }>;
}) {
  const params = await searchParams;
  const ingredient = Array.isArray(params.ingredient)
    ? params.ingredient[0]
    : params.ingredient;
  return (
    <InventoryManagementPage
      key={ingredient ?? "inventory"}
      initialIngredientId={ingredient ?? null}
    />
  );
}
