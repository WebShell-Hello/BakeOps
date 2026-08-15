"use client";

import {
  BookOpenText,
  ChevronDown,
  ChevronRight,
  CircleOff,
  PoundSterling as CirclePoundSterling,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DataPagination,
  useDataPagination,
} from "@/components/ui/data-pagination";
import {
  createBakeryProduct,
  createProductIngredient,
  deleteProductIngredient,
  getBakeryProducts,
  updateBakeryProduct,
  updateProductIngredient,
  type BakeryProduct,
  type BakeryProductInput,
  type ProductIngredientInput,
  type ProductRecipeIngredient,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type ProductEditor = BakeryProduct | null | undefined;
type IngredientEditor = {
  product: BakeryProduct;
  item: ProductRecipeIngredient | null;
} | null;

const emptyProductForm: BakeryProductInput = {
  name_zh: "",
  name_en: "",
  sale_status: "ON_SALE",
  notes: "",
  yield_quantity: 1,
  yield_unit: "个",
  production_description: "",
};

const emptyIngredientForm: ProductIngredientInput = {
  ingredient_name: "",
  section_name: "配方",
  weight: "",
  unit: "g",
  preparation_note: "",
};

const copy = {
  "zh-CN": {
    title: "产品与配方",
    description: "管理产品、制作步骤和配方原材料",
    addProduct: "新增产品",
    searchPlaceholder: "查找产品名称或备注",
    productName: "产品名称",
    productNameZh: "中文名称",
    productNameEn: "英文名称",
    ingredients: "成分",
    totalWeight: "配方总重量",
    estimatedPrice: "当前预估成本（整批）",
    status: "状态",
    notes: "备注",
    actions: "操作",
    onSale: "在售",
    offSale: "停售",
    ingredientCount: (count: number) => `${count} 种原材料`,
    loading: "正在读取产品和配方...",
    empty: "没有符合条件的产品",
    noIngredients: "该产品还没有成分",
    section: "配方分区",
    ingredient: "原材料",
    weight: "重量",
    preparationNote: "处理说明",
    detail: "制作详情",
    edit: "编辑产品",
    addIngredient: "添加成分",
    editIngredient: "编辑成分",
    createProductTitle: "新增产品",
    editProductTitle: "编辑产品",
    yieldQuantity: "配方产量",
    yieldUnit: "产量单位",
    productionDescription: "制作步骤描述",
    productionPlaceholder: "按步骤填写完整制作流程",
    save: "保存",
    cancel: "取消",
    delete: "删除",
    deleteIngredientConfirm: "确定删除这条配方成分吗？",
    saved: "产品信息已保存",
    ingredientSaved: "配方成分已保存",
    ingredientDeleted: "配方成分已删除",
    statusUpdated: "产品状态已更新",
    loadError: "产品数据加载失败",
    saveError: "保存失败，请检查填写内容",
    pricePending: "无法计算",
    priceHint:
      "按当前库存加权平均成本计算整批配方成本；生产和成本管理会再按配方产量折算单份成本。",
    missingCost: (count: number) => `${count}项食材缺少成本`,
    internalCode: "内部编码",
    noDescription: "尚未填写制作步骤",
  },
  "en-GB": {
    title: "Product & Recipe",
    description: "Manage products, preparation steps and recipe ingredients",
    addProduct: "Add product",
    searchPlaceholder: "Find by product name or notes",
    productName: "Product name",
    productNameZh: "Chinese name",
    productNameEn: "English name",
    ingredients: "Ingredients",
    totalWeight: "Recipe weight",
    estimatedPrice: "Current estimated cost (batch)",
    status: "Status",
    notes: "Notes",
    actions: "Actions",
    onSale: "On sale",
    offSale: "Off sale",
    ingredientCount: (count: number) =>
      `${count} ingredient${count === 1 ? "" : "s"}`,
    loading: "Loading products and recipes...",
    empty: "No matching products",
    noIngredients: "This product has no ingredients yet",
    section: "Recipe section",
    ingredient: "Ingredient",
    weight: "Weight",
    preparationNote: "Preparation note",
    detail: "Preparation details",
    edit: "Edit product",
    addIngredient: "Add ingredient",
    editIngredient: "Edit ingredient",
    createProductTitle: "Add product",
    editProductTitle: "Edit product",
    yieldQuantity: "Recipe yield",
    yieldUnit: "Yield unit",
    productionDescription: "Preparation steps",
    productionPlaceholder:
      "Enter the complete preparation process step by step",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    deleteIngredientConfirm: "Delete this recipe ingredient?",
    saved: "Product details saved",
    ingredientSaved: "Recipe ingredient saved",
    ingredientDeleted: "Recipe ingredient deleted",
    statusUpdated: "Product status updated",
    loadError: "Unable to load products",
    saveError: "Unable to save. Check the details and try again.",
    pricePending: "Cannot calculate",
    priceHint:
      "Calculated as the full batch cost from current weighted-average inventory cost; production and cost management convert it to a per-unit cost using the recipe yield.",
    missingCost: (count: number) => `${count} ingredient${count === 1 ? "" : "s"} missing cost`,
    internalCode: "Internal code",
    noDescription: "No preparation steps have been added",
  },
} as const;

export function ProductManagementPage({ initialSearch = "" }: { initialSearch?: string }) {
  const { locale } = useAppPreferences();
  const { showSuccess } = useToast();
  const text = copy[locale];
  const [products, setProducts] = useState<BakeryProduct[]>([]);
  const [query, setQuery] = useState(initialSearch);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [productEditor, setProductEditor] = useState<ProductEditor>(undefined);
  const [productForm, setProductForm] =
    useState<BakeryProductInput>(emptyProductForm);
  const [ingredientEditor, setIngredientEditor] =
    useState<IngredientEditor>(null);
  const [ingredientForm, setIngredientForm] =
    useState<ProductIngredientInput>(emptyIngredientForm);
  const [detailProduct, setDetailProduct] = useState<BakeryProduct | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const normalised = query.trim().toLocaleLowerCase(locale);
    if (!normalised) return products;
    return products.filter((product) =>
      `${product.name_zh} ${product.name_en} ${product.notes}`
        .toLocaleLowerCase(locale)
        .includes(normalised),
    );
  }, [locale, products, query]);
  const productPagination = useDataPagination(filteredProducts);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProducts(await getBakeryProducts());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [text.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function openCreateProduct() {
    setProductForm(emptyProductForm);
    setProductEditor(null);
  }

  function openEditProduct(product: BakeryProduct) {
    setProductForm(productToInput(product));
    setProductEditor(product);
  }

  function openCreateIngredient(product: BakeryProduct) {
    setIngredientForm({
      ...emptyIngredientForm,
      section_name:
        product.active_recipe?.sections[0]?.name ??
        emptyIngredientForm.section_name,
    });
    setIngredientEditor({ product, item: null });
  }

  function openEditIngredient(
    product: BakeryProduct,
    item: ProductRecipeIngredient,
  ) {
    setIngredientForm({
      ingredient_name: item.ingredient_name,
      section_name: item.section_name,
      weight: trimDecimal(item.weight),
      unit: item.unit,
      preparation_note: item.preparation_note,
    });
    setIngredientEditor({ product, item });
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const input = {
      ...productForm,
      name_zh: productForm.name_zh.trim(),
      name_en: productForm.name_en.trim(),
      notes: productForm.notes.trim(),
      yield_unit: productForm.yield_unit.trim(),
      production_description: productForm.production_description.trim(),
    };
    try {
      if (productEditor) await updateBakeryProduct(productEditor.id, input);
      else await createBakeryProduct(input);
      setProductEditor(undefined);
      showSuccess(text.saved);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function saveIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ingredientEditor) return;
    setSaving(true);
    setError(null);
    const input = {
      ...ingredientForm,
      ingredient_name: ingredientForm.ingredient_name.trim(),
      section_name: ingredientForm.section_name.trim(),
      preparation_note: ingredientForm.preparation_note.trim(),
    };
    try {
      if (ingredientEditor.item)
        await updateProductIngredient(ingredientEditor.item.id, input);
      else await createProductIngredient(ingredientEditor.product.id, input);
      setExpandedIds((current) =>
        current.includes(ingredientEditor.product.id)
          ? current
          : [...current, ingredientEditor.product.id],
      );
      setIngredientEditor(null);
      showSuccess(text.ingredientSaved);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function removeIngredient() {
    const item = ingredientEditor?.item;
    if (!item || !window.confirm(text.deleteIngredientConfirm)) return;
    setSaving(true);
    try {
      await deleteProductIngredient(item.id);
      setIngredientEditor(null);
      showSuccess(text.ingredientDeleted);
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : text.saveError,
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(product: BakeryProduct) {
    setSaving(true);
    try {
      await updateBakeryProduct(product.id, {
        ...productToInput(product),
        sale_status: product.sale_status === "ON_SALE" ? "OFF_SALE" : "ON_SALE",
      });
      showSuccess(text.statusUpdated);
      await load();
    } catch (statusError) {
      setError(
        statusError instanceof Error ? statusError.message : text.saveError,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <PageBreadcrumb fallback={{ zh: text.title, en: text.title }} />
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              {text.description}
            </p>
          </div>
          <Button variant="outline" onClick={openCreateProduct}>
            <Plus className="size-4" />
            {text.addProduct}
          </Button>
        </header>

        <Card className="overflow-hidden">
          {error ? (
            <button
              type="button"
              className="w-full border-b border-rose-500/20 bg-[var(--danger-soft)] px-4 py-3 text-left text-sm text-rose-600"
              onClick={() => setError(null)}
            >
              {error}
            </button>
          ) : null}
          <div className="border-b border-[var(--border)] p-4">
            <label className="relative block w-full max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                className={`${inputClass} pl-9`}
                value={query}
                placeholder={text.searchPlaceholder}
                onChange={(event) => {
                  setQuery(event.target.value);
                  productPagination.resetPage();
                }}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[16%]" />
                <col className="w-[8%]" />
                <col className="w-[11%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">{text.productName}</th>
                  <th className="px-4 py-3">{text.ingredients}</th>
                  <th className="px-4 py-3">{text.totalWeight}</th>
                  <th className="px-4 py-3">{text.yieldQuantity}</th>
                  <th className="px-4 py-3">{text.estimatedPrice}</th>
                  <th className="px-4 py-3">{text.status}</th>
                  <th className="px-4 py-3">{text.notes}</th>
                  <th className="px-4 py-3 text-right">{text.actions}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-16 text-center text-[var(--muted)]"
                    >
                      {text.loading}
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-16 text-center text-[var(--muted)]"
                    >
                      {text.empty}
                    </td>
                  </tr>
                ) : (
                  productPagination.pageItems.map((product) => {
                    const expanded = expandedIds.includes(product.id);
                    const items =
                      product.active_recipe?.sections.flatMap(
                        (section) => section.items,
                      ) ?? [];
                    return (
                      <ProductRows
                        key={product.id}
                        product={product}
                        items={items}
                        expanded={expanded}
                        text={text}
                        locale={locale}
                        saving={saving}
                        onToggleExpand={() =>
                          setExpandedIds((current) =>
                            expanded
                              ? current.filter((id) => id !== product.id)
                              : [...current, product.id],
                          )
                        }
                        onEditProduct={() => openEditProduct(product)}
                        onDetail={() => setDetailProduct(product)}
                        onAddIngredient={() => openCreateIngredient(product)}
                        onEditIngredient={(item) =>
                          openEditIngredient(product, item)
                        }
                        onToggleStatus={() => void toggleStatus(product)}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <DataPagination
            locale={locale}
            page={productPagination.page}
            pageSize={productPagination.pageSize}
            pageCount={productPagination.pageCount}
            totalItems={filteredProducts.length}
            onPageChange={productPagination.setPage}
            onPageSizeChange={productPagination.setPageSize}
          />
        </Card>
      </main>

      {productEditor !== undefined ? (
        <ProductModal
          title={
            productEditor ? text.editProductTitle : text.createProductTitle
          }
          text={text}
          form={productForm}
          saving={saving}
          onChange={setProductForm}
          onClose={() => setProductEditor(undefined)}
          onSubmit={saveProduct}
        />
      ) : null}
      {ingredientEditor ? (
        <IngredientModal
          text={text}
          editor={ingredientEditor}
          form={ingredientForm}
          saving={saving}
          onChange={setIngredientForm}
          onClose={() => setIngredientEditor(null)}
          onSubmit={saveIngredient}
          onDelete={() => void removeIngredient()}
        />
      ) : null}
      {detailProduct ? (
        <DetailModal
          product={detailProduct}
          text={text}
          onClose={() => setDetailProduct(null)}
        />
      ) : null}
    </DashboardShell>
  );
}

function ProductRows({
  product,
  items,
  expanded,
  text,
  locale,
  saving,
  onToggleExpand,
  onEditProduct,
  onDetail,
  onAddIngredient,
  onEditIngredient,
  onToggleStatus,
}: {
  product: BakeryProduct;
  items: ProductRecipeIngredient[];
  expanded: boolean;
  text: (typeof copy)["zh-CN"] | (typeof copy)["en-GB"];
  locale: "zh-CN" | "en-GB";
  saving: boolean;
  onToggleExpand: () => void;
  onEditProduct: () => void;
  onDetail: () => void;
  onAddIngredient: () => void;
  onEditIngredient: (item: ProductRecipeIngredient) => void;
  onToggleStatus: () => void;
}) {
  const recipe = product.active_recipe;
  const estimatedCost = product.current_estimated_cost;
  const primaryName =
    locale === "zh-CN" ? product.name_zh : product.name_en;
  const secondaryName =
    locale === "zh-CN" ? product.name_en : product.name_zh;
  return (
    <>
      <tr className="border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-muted)]">
        <td className="px-4 py-3">
          <button
            type="button"
            className="flex min-w-0 items-center gap-3 text-left"
            onClick={onToggleExpand}
          >
            {expanded ? (
              <ChevronDown className="size-4 text-[var(--muted)]" />
            ) : (
              <ChevronRight className="size-4 text-[var(--muted)]" />
            )}
            <span className="min-w-0">
              <span className="block break-words font-medium">{primaryName}</span>
              {secondaryName !== primaryName ? (
                <span className="block break-words text-xs text-[var(--muted)]">
                  {secondaryName}
                </span>
              ) : null}
            </span>
          </button>
        </td>
        <td className="px-4 py-3">{text.ingredientCount(items.length)}</td>
        <td className="px-4 py-3">
          {recipe ? `${trimDecimal(recipe.total_weight)} g` : "—"}
        </td>
        <td className="px-4 py-3 tabular-nums">
          {recipe ? `${recipe.yield_quantity} ${recipe.yield_unit}` : "—"}
        </td>
        <td className="px-4 py-3">
          <span
            title={
              estimatedCost?.missing_ingredients.length
                ? `${text.priceHint} · ${estimatedCost.missing_ingredients.join(", ")}`
                : text.priceHint
            }
            className={cn(
              "inline-flex max-w-full items-start gap-1.5 text-sm",
              estimatedCost?.is_complete ? "text-[var(--foreground)]" : "text-amber-700",
            )}
          >
            <CirclePoundSterling className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0">
              <span className="block font-medium">
                {estimatedCostPrimary(estimatedCost, text)}
              </span>
              {estimatedCost?.missing_ingredient_count ? (
                <span className="mt-0.5 block text-xs leading-4">
                  {estimatedCost.amount && Number(estimatedCost.amount) > 0 ? "+ " : ""}
                  {text.missingCost(estimatedCost.missing_ingredient_count)}
                </span>
              ) : null}
            </span>
          </span>
        </td>
        <td className="px-4 py-3">
          <button
            type="button"
            disabled={saving}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              product.sale_status === "ON_SALE"
                ? "bg-[var(--success-soft)] text-emerald-600"
                : "bg-[var(--surface-muted)] text-[var(--muted)]",
            )}
            onClick={onToggleStatus}
          >
            {product.sale_status === "ON_SALE" ? (
              <ShoppingBag className="size-3.5" />
            ) : (
              <CircleOff className="size-3.5" />
            )}
            {product.sale_status === "ON_SALE" ? text.onSale : text.offSale}
          </button>
        </td>
        <td className="max-w-64 px-4 py-3 text-[var(--muted)]">
          <p className="truncate" title={product.notes}>
            {product.notes || "—"}
          </p>
        </td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              title={text.detail}
              aria-label={`${text.detail}: ${primaryName}`}
              onClick={onDetail}
            >
              <BookOpenText className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              title={text.addIngredient}
              aria-label={`${text.addIngredient}: ${primaryName}`}
              onClick={onAddIngredient}
            >
              <PackagePlus className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              title={text.edit}
              aria-label={`${text.edit}: ${primaryName}`}
              onClick={onEditProduct}
            >
              <Pencil className="size-4" />
            </Button>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-t border-[var(--border)] bg-[var(--surface-muted)]/35">
          <td colSpan={8} className="p-4">
            <div className="space-y-4">
              {recipe?.sections.length ? (
                recipe.sections.map((section) => (
                  <section
                    key={section.id}
                    className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
                  >
                    <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5">
                      <h3 className="text-sm font-semibold">{section.name}</h3>
                      <span className="text-xs text-[var(--muted)]">
                        {text.ingredientCount(section.items.length)}
                      </span>
                    </div>
                    <table className="w-full min-w-[700px] text-sm">
                      <thead className="text-left text-xs text-[var(--muted)]">
                        <tr>
                          <th className="px-4 py-2.5">{text.ingredient}</th>
                          <th className="w-36 px-4 py-2.5">{text.weight}</th>
                          <th className="w-40 px-4 py-2.5">
                            {text.estimatedPrice}
                          </th>
                          <th className="px-4 py-2.5">
                            {text.preparationNote}
                          </th>
                          <th className="w-20 px-4 py-2.5 text-right">
                            {text.actions}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.items.map((item) => (
                          <tr
                            key={item.id}
                            className="border-t border-[var(--border)]"
                          >
                            <td className="px-4 py-3 font-medium">
                              {item.ingredient_name}
                            </td>
                            <td className="px-4 py-3 tabular-nums">
                              {trimDecimal(item.weight)} {item.unit}
                            </td>
                            <td className="px-4 py-3 text-[var(--muted)]">
                              {item.estimated_price
                                ? formatPrice(item.estimated_price)
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-[var(--muted)]">
                              {item.preparation_note || "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`${text.editIngredient}: ${item.ingredient_name}`}
                                onClick={() => onEditIngredient(item)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
                  {text.noIngredients}
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={onAddIngredient}>
                  <Plus className="size-4" />
                  {text.addIngredient}
                </Button>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ProductModal({
  title,
  text,
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  title: string;
  text: (typeof copy)["zh-CN"] | (typeof copy)["en-GB"];
  form: BakeryProductInput;
  saving: boolean;
  onChange: (form: BakeryProductInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal title={title} closeLabel={text.cancel} onClose={onClose}>
      <form className="space-y-4 p-5" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={text.productNameZh}>
            <input
              required
              maxLength={120}
              className={inputClass}
              value={form.name_zh}
              onChange={(event) =>
                onChange({ ...form, name_zh: event.target.value })
              }
            />
          </Field>
          <Field label={text.productNameEn}>
            <input
              required
              maxLength={120}
              className={inputClass}
              value={form.name_en}
              onChange={(event) =>
                onChange({ ...form, name_en: event.target.value })
              }
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={text.yieldQuantity}>
            <input
              required
              min={1}
              type="number"
              className={inputClass}
              value={form.yield_quantity}
              onChange={(event) =>
                onChange({
                  ...form,
                  yield_quantity: Number(event.target.value),
                })
              }
            />
          </Field>
          <Field label={text.yieldUnit}>
            <input
              required
              maxLength={24}
              className={inputClass}
              value={form.yield_unit}
              onChange={(event) =>
                onChange({ ...form, yield_unit: event.target.value })
              }
            />
          </Field>
          <Field label={text.status}>
            <select
              className={inputClass}
              value={form.sale_status}
              onChange={(event) =>
                onChange({
                  ...form,
                  sale_status: event.target
                    .value as BakeryProductInput["sale_status"],
                })
              }
            >
              <option value="ON_SALE">{text.onSale}</option>
              <option value="OFF_SALE">{text.offSale}</option>
            </select>
          </Field>
        </div>
        <Field label={text.productionDescription}>
          <textarea
            rows={9}
            className={`${inputClass} h-auto py-2`}
            value={form.production_description}
            placeholder={text.productionPlaceholder}
            onChange={(event) =>
              onChange({ ...form, production_description: event.target.value })
            }
          />
        </Field>
        <Field label={text.notes}>
          <textarea
            rows={3}
            className={`${inputClass} h-auto py-2`}
            value={form.notes}
            onChange={(event) =>
              onChange({ ...form, notes: event.target.value })
            }
          />
        </Field>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {text.cancel}
          </Button>
          <Button type="submit" variant="outline" disabled={saving}>
            {text.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function IngredientModal({
  text,
  editor,
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
  onDelete,
}: {
  text: (typeof copy)["zh-CN"] | (typeof copy)["en-GB"];
  editor: NonNullable<IngredientEditor>;
  form: ProductIngredientInput;
  saving: boolean;
  onChange: (form: ProductIngredientInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
}) {
  const sectionNames =
    editor.product.active_recipe?.sections.map((section) => section.name) ?? [];
  return (
    <Modal
      title={editor.item ? text.editIngredient : text.addIngredient}
      closeLabel={text.cancel}
      narrow
      onClose={onClose}
    >
      <form className="space-y-4 p-5" onSubmit={onSubmit}>
        <Field label={text.section}>
          <input
            required
            maxLength={100}
            list="recipe-section-options"
            className={inputClass}
            value={form.section_name}
            onChange={(event) =>
              onChange({ ...form, section_name: event.target.value })
            }
          />
          <datalist id="recipe-section-options">
            {sectionNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>
        <Field label={text.ingredient}>
          <input
            required
            maxLength={120}
            className={inputClass}
            value={form.ingredient_name}
            onChange={(event) =>
              onChange({ ...form, ingredient_name: event.target.value })
            }
          />
        </Field>
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-4">
          <Field label={text.weight}>
            <input
              required
              min="0.001"
              step="0.001"
              type="number"
              className={inputClass}
              value={form.weight}
              onChange={(event) =>
                onChange({ ...form, weight: event.target.value })
              }
            />
          </Field>
          <Field label={text.yieldUnit}>
            <input
              required
              maxLength={16}
              className={inputClass}
              value={form.unit}
              onChange={(event) =>
                onChange({ ...form, unit: event.target.value })
              }
            />
          </Field>
        </div>
        <Field label={text.preparationNote}>
          <input
            maxLength={255}
            className={inputClass}
            value={form.preparation_note}
            onChange={(event) =>
              onChange({ ...form, preparation_note: event.target.value })
            }
          />
        </Field>
        <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-xs text-[var(--muted)]">
          <span className="font-medium">{text.pricePending}</span>
          <span className="mt-1 block">{text.priceHint}</span>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
          {editor.item ? (
            <Button
              type="button"
              variant="ghost"
              className="text-rose-500"
              disabled={saving}
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
              {text.delete}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {text.cancel}
            </Button>
            <Button type="submit" variant="outline" disabled={saving}>
              {text.save}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function DetailModal({
  product,
  text,
  onClose,
}: {
  product: BakeryProduct;
  text: (typeof copy)["zh-CN"] | (typeof copy)["en-GB"];
  onClose: () => void;
}) {
  const recipe = product.active_recipe;
  return (
    <Modal
      title={`${product.name_zh} / ${product.name_en} · ${text.detail}`}
      closeLabel={text.cancel}
      onClose={onClose}
    >
      <div className="space-y-5 p-5">
        <div className="grid gap-3 rounded-xl bg-[var(--surface-muted)] p-4 text-sm sm:grid-cols-3">
          <div>
            <span className="block text-xs text-[var(--muted)]">
              {text.internalCode}
            </span>
            <code>{product.code}</code>
          </div>
          <div>
            <span className="block text-xs text-[var(--muted)]">
              {text.totalWeight}
            </span>
            {recipe ? `${trimDecimal(recipe.total_weight)} g` : "—"}
          </div>
          <div>
            <span className="block text-xs text-[var(--muted)]">
              {text.yieldQuantity}
            </span>
            {recipe ? `${recipe.yield_quantity} ${recipe.yield_unit}` : "—"}
          </div>
        </div>
        <section>
          <h3 className="mb-2 font-semibold">{text.productionDescription}</h3>
          <div className="whitespace-pre-wrap rounded-xl border border-[var(--border)] p-4 text-sm leading-7">
            {recipe?.production_description || text.noDescription}
          </div>
        </section>
        {product.notes ? (
          <section>
            <h3 className="mb-2 font-semibold">{text.notes}</h3>
            <p className="rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
              {product.notes}
            </p>
          </section>
        ) : null}
        <div className="flex justify-end border-t border-[var(--border)] pt-4">
          <Button variant="outline" onClick={onClose}>
            {text.cancel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  closeLabel,
  narrow = false,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  narrow?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl",
          narrow ? "max-w-lg" : "max-w-3xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function productToInput(product: BakeryProduct): BakeryProductInput {
  return {
    name_zh: product.name_zh,
    name_en: product.name_en,
    sale_status: product.sale_status,
    notes: product.notes,
    yield_quantity: product.active_recipe?.yield_quantity ?? 1,
    yield_unit: product.active_recipe?.yield_unit ?? "个",
    production_description: product.active_recipe?.production_description ?? "",
  };
}
function trimDecimal(value: string) {
  return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}
function formatPrice(value: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value));
}
function estimatedCostPrimary(
  cost: BakeryProduct["current_estimated_cost"],
  text: (typeof copy)["zh-CN"] | (typeof copy)["en-GB"],
) {
  if (!cost || !cost.amount) return text.pricePending;
  return !cost.is_complete && Number(cost.amount) === 0
    ? text.pricePending
    : formatPrice(cost.amount);
}

const inputClass =
  "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)]";
