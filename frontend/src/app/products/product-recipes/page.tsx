import { ProductManagementPage } from "@/components/products/product-management-page";

export default async function ProductRecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[] }>;
}) {
  const params = await searchParams;
  const search = Array.isArray(params.search) ? params.search[0] : params.search;
  return (
    <ProductManagementPage
      key={search ?? ""}
      initialSearch={search ?? ""}
    />
  );
}
