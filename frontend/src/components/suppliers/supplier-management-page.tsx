"use client";

import {
  Ban,
  Building2,
  Clock3,
  Eye,
  Mail,
  MapPin,
  PackageOpen,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Star,
  UserRound,
  Wheat,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type MouseEvent,
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
  createSupplier,
  createSupplierIngredient,
  getSupplierIngredientOptions,
  getSuppliers,
  updateSupplier,
  updateSupplierIngredient,
  type IngredientOption,
  type Supplier,
  type SupplierIngredient,
  type SupplierIngredientInput,
  type SupplierInput,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const emptySupplier: SupplierInput = {
  name: "",
  address: "",
  contact_name: "",
  phone: "",
  email: "",
  notes: "",
};

const emptyTerm: SupplierIngredientInput = {
  ingredient: "",
  unit_price: "",
  currency: "GBP",
  price_unit: "kg",
  minimum_order_quantity: "",
  minimum_order_unit: "kg",
  lead_time_days: 0,
  notes: "",
  is_active: true,
  is_preferred: false,
};

const copy = {
  "zh-CN": {
    parent: "运营管理",
    title: "供应商管理",
    description: "维护食材采购来源、价格和供应条件",
    supplierView: "供应商列表",
    ingredientView: "食材列表",
    addSupplier: "新增供应商",
    searchPlaceholder: "搜索供应商名称、地址、联系人或备注",
    ingredientSearchPlaceholder: "搜索食材或供应商",
    search: "搜索供应商",
    searchIngredients: "搜索食材",
    clear: "清除",
    supplier: "供应商",
    address: "地址",
    contact: "联系方式",
    suppliedCount: "供应食材数",
    specification: "规格",
    supplierNotConfigured: "未配置供应商",
    allIngredientsEmpty: "没有符合条件的食材",
    priceUnit: (unit: string) => `按 ${unit} 计价`,
    notes: "备注",
    actions: "操作",
    view: "查看",
    edit: "编辑",
    loading: "正在读取供应商...",
    empty: "没有符合条件的供应商",
    ingredients: (count: number) => `${count} 种食材`,
    noAddress: "未填写地址",
    noContact: "未填写联系方式",
    noNotes: "—",
    basicInfo: "基础信息",
    contactName: "联系人",
    phone: "电话",
    email: "Email",
    suppliedIngredients: "可供应食材",
    addIngredient: "添加食材",
    ingredient: "食材",
    unitPrice: "单价",
    unit: "单位",
    moq: "MOQ",
    leadTime: "提前预订",
    ingredientNotes: "采购备注",
    preferred: "首选",
    status: "状态",
    active: "供应中",
    inactive: "已停用",
    days: (days: number) => `${days} 天`,
    sameDay: "当天",
    noIngredients: "尚未配置可供应食材",
    setPreferred: "设为首选供应商",
    disable: "停用食材",
    enable: "恢复供应",
    createSupplierTitle: "新增供应商",
    editSupplierTitle: "编辑供应商",
    addIngredientTitle: "添加供应食材",
    editIngredientTitle: "编辑采购条件",
    save: "保存",
    cancel: "取消",
    supplierSaved: "供应商信息已保存",
    ingredientSaved: "采购条件已保存",
    preferredSaved: "首选供应商已更新",
    statusSaved: "供应状态已更新",
    loadError: "供应商数据加载失败",
    saveError: "保存失败，请检查填写内容",
    name: "供应商名称",
    price: "价格",
    currency: "币种",
    minimumOrderQuantity: "最低起订量",
    minimumOrderUnit: "MOQ 单位",
    leadTimeDays: "提前天数",
    selectIngredient: "选择当前配方食材",
    preferredLabel: "设为该食材的首选供应商",
    activeLabel: "当前可供应",
    ingredientUnavailable: "当前配方中没有可添加的食材",
    duplicateHint: "一个供应商不能重复配置同一种食材。",
    close: "关闭供应商详情",
  },
  "en-GB": {
    parent: "Operations",
    title: "Supplier Management",
    description: "Manage ingredient sources, pricing and supply terms",
    supplierView: "Supplier list",
    ingredientView: "Ingredient list",
    addSupplier: "Add supplier",
    searchPlaceholder: "Search supplier, address, contact or notes",
    ingredientSearchPlaceholder: "Search ingredient or supplier",
    search: "Search suppliers",
    searchIngredients: "Search ingredients",
    clear: "Clear",
    supplier: "Supplier",
    address: "Address",
    contact: "Contact",
    suppliedCount: "Ingredients",
    specification: "Specification",
    supplierNotConfigured: "No supplier configured",
    allIngredientsEmpty: "No matching ingredients",
    priceUnit: (unit: string) => `Priced per ${unit}`,
    notes: "Notes",
    actions: "Actions",
    view: "View",
    edit: "Edit",
    loading: "Loading suppliers...",
    empty: "No matching suppliers",
    ingredients: (count: number) =>
      `${count} ingredient${count === 1 ? "" : "s"}`,
    noAddress: "No address",
    noContact: "No contact details",
    noNotes: "—",
    basicInfo: "Supplier details",
    contactName: "Contact person",
    phone: "Phone",
    email: "Email",
    suppliedIngredients: "Supplied ingredients",
    addIngredient: "Add ingredient",
    ingredient: "Ingredient",
    unitPrice: "Unit price",
    unit: "Unit",
    moq: "MOQ",
    leadTime: "Lead time",
    ingredientNotes: "Notes",
    preferred: "Preferred",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    days: (days: number) => `${days} day${days === 1 ? "" : "s"}`,
    sameDay: "Same day",
    noIngredients: "No supplied ingredients configured",
    setPreferred: "Set as preferred supplier",
    disable: "Disable ingredient",
    enable: "Restore supply",
    createSupplierTitle: "Add supplier",
    editSupplierTitle: "Edit supplier",
    addIngredientTitle: "Add supplied ingredient",
    editIngredientTitle: "Edit supply terms",
    save: "Save",
    cancel: "Cancel",
    supplierSaved: "Supplier details saved",
    ingredientSaved: "Supply terms saved",
    preferredSaved: "Preferred supplier updated",
    statusSaved: "Supply status updated",
    loadError: "Unable to load suppliers",
    saveError: "Unable to save. Check the details and try again.",
    name: "Supplier name",
    price: "Price",
    currency: "Currency",
    minimumOrderQuantity: "Minimum order quantity",
    minimumOrderUnit: "MOQ unit",
    leadTimeDays: "Lead time in days",
    selectIngredient: "Select an ingredient used by current recipes",
    preferredLabel: "Preferred supplier for this ingredient",
    activeLabel: "Currently supplied",
    ingredientUnavailable: "No current recipe ingredients are available to add",
    duplicateHint: "An ingredient can only be configured once per supplier.",
    close: "Close supplier details",
  },
} as const;

type SupplierView = "suppliers" | "ingredients";

type IngredientSupplyRow = {
  key: string;
  ingredient: IngredientOption;
  supplier: Supplier | null;
  term: SupplierIngredient | null;
};

export function SupplierManagementPage() {
  const { locale } = useAppPreferences();
  const { showSuccess } = useToast();
  const text = copy[locale];
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredientOptions, setIngredientOptions] = useState<
    IngredientOption[]
  >([]);
  const [view, setView] = useState<SupplierView>("suppliers");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    null,
  );
  const [supplierEditor, setSupplierEditor] = useState<
    Supplier | null | undefined
  >(undefined);
  const [supplierForm, setSupplierForm] =
    useState<SupplierInput>(emptySupplier);
  const [termEditor, setTermEditor] = useState<
    SupplierIngredient | null | undefined
  >(undefined);
  const [termForm, setTermForm] =
    useState<SupplierIngredientInput>(emptyTerm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedSupplier =
    suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null;

  const supplierRows = useMemo(() => {
    const search = appliedQuery.toLocaleLowerCase(locale);
    if (!search) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.address, supplier.contact_name, supplier.phone, supplier.email, supplier.notes]
        .some((value) => value.toLocaleLowerCase(locale).includes(search)),
    );
  }, [appliedQuery, locale, suppliers]);

  const ingredientRows = useMemo<IngredientSupplyRow[]>(() => {
    const termsByIngredient = new Map<string, Array<{ supplier: Supplier; term: SupplierIngredient }>>();
    for (const supplier of suppliers) {
      for (const term of supplier.supplied_ingredients) {
        const terms = termsByIngredient.get(term.ingredient) ?? [];
        terms.push({ supplier, term });
        termsByIngredient.set(term.ingredient, terms);
      }
    }

    const search = appliedQuery.toLocaleLowerCase(locale);
    return ingredientOptions.flatMap((ingredient) => {
      const terms = termsByIngredient.get(ingredient.id) ?? [];
      const rows: IngredientSupplyRow[] = terms.length
        ? terms
            .sort((left, right) => Number(right.term.is_preferred) - Number(left.term.is_preferred)
              || left.supplier.name.localeCompare(right.supplier.name, locale))
            .map(({ supplier, term }) => ({
              key: term.id,
              ingredient,
              supplier,
              term,
            }))
        : [{ key: ingredient.id, ingredient, supplier: null, term: null }];
      if (!search) return rows;
      return rows.filter((row) =>
        row.ingredient.name.toLocaleLowerCase(locale).includes(search)
        || row.supplier?.name.toLocaleLowerCase(locale).includes(search),
      );
    });
  }, [appliedQuery, ingredientOptions, locale, suppliers]);

  const supplierPagination = useDataPagination(supplierRows);
  const ingredientPagination = useDataPagination(ingredientRows);

  const availableIngredientOptions = useMemo(() => {
    if (!selectedSupplier) return ingredientOptions;
    const configured = new Set(
      selectedSupplier.supplied_ingredients
        .filter((item) => item.id !== termEditor?.id)
        .map((item) => item.ingredient),
    );
    return ingredientOptions.filter((option) => !configured.has(option.id));
  }, [ingredientOptions, selectedSupplier, termEditor?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSuppliers, nextOptions] = await Promise.all([
        getSuppliers(),
        getSupplierIngredientOptions(),
      ]);
      setSuppliers(nextSuppliers);
      setIngredientOptions(nextOptions);
      setSelectedSupplierId((current) =>
        current && nextSuppliers.some((supplier) => supplier.id === current)
          ? current
          : null,
      );
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

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedQuery(query.trim());
    supplierPagination.resetPage();
    ingredientPagination.resetPage();
  }

  function changeView(nextView: SupplierView) {
    setView(nextView);
    setQuery("");
    setAppliedQuery("");
    setSelectedSupplierId(null);
    supplierPagination.resetPage();
    ingredientPagination.resetPage();
  }

  function openCreateSupplier() {
    setSupplierForm(emptySupplier);
    setSupplierEditor(null);
  }

  function openEditSupplier(supplier: Supplier, event?: MouseEvent) {
    event?.stopPropagation();
    setSupplierForm({
      name: supplier.name,
      address: supplier.address,
      contact_name: supplier.contact_name,
      phone: supplier.phone,
      email: supplier.email,
      notes: supplier.notes,
    });
    setSupplierEditor(supplier);
  }

  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = supplierEditor
        ? await updateSupplier(supplierEditor.id, supplierForm)
        : await createSupplier(supplierForm);
      setSupplierEditor(undefined);
      setSelectedSupplierId(saved.id);
      showSuccess(text.supplierSaved);
      await load();
      setSelectedSupplierId(saved.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.saveError);
    } finally {
      setSaving(false);
    }
  }

  function openCreateTerm() {
    const firstOption = availableIngredientOptions[0];
    setTermForm({
      ...emptyTerm,
      ingredient: firstOption?.id ?? "",
      price_unit: unitFor(firstOption),
      minimum_order_unit: unitFor(firstOption),
    });
    setTermEditor(null);
  }

  function openEditTerm(item: SupplierIngredient) {
    setTermForm({
      ingredient: item.ingredient,
      unit_price: trimDecimal(item.unit_price),
      currency: item.currency,
      price_unit: item.price_unit,
      minimum_order_quantity: trimDecimal(item.minimum_order_quantity),
      minimum_order_unit: item.minimum_order_unit,
      lead_time_days: item.lead_time_days,
      notes: item.notes,
      is_active: item.is_active,
      is_preferred: item.is_preferred,
    });
    setTermEditor(item);
  }

  async function saveTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSupplier) return;
    setSaving(true);
    setError(null);
    try {
      if (termEditor) await updateSupplierIngredient(termEditor.id, termForm);
      else await createSupplierIngredient(selectedSupplier.id, termForm);
      setTermEditor(undefined);
      showSuccess(text.ingredientSaved);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function updateTermStatus(
    item: SupplierIngredient,
    input: Partial<SupplierIngredientInput>,
    message: string,
  ) {
    setOperatingId(item.id);
    setError(null);
    try {
      await updateSupplierIngredient(item.id, input);
      showSuccess(message);
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error ? operationError.message : text.saveError,
      );
    } finally {
      setOperatingId(null);
    }
  }

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <PageBreadcrumb fallback={{ zh: text.title, en: text.title }} />
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              {text.description}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form className="flex min-w-0 gap-2" onSubmit={search}>
              <label className="relative min-w-0 flex-1 sm:w-80">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={view === "suppliers" ? text.searchPlaceholder : text.ingredientSearchPlaceholder}
                  aria-label={view === "suppliers" ? text.search : text.searchIngredients}
                  className={cn(inputClass, "pl-9")}
                />
              </label>
              <Button
                type="submit"
                variant="outline"
                aria-label={view === "suppliers" ? text.search : text.searchIngredients}
              >
                <Search className="size-4" />
                <span className="hidden sm:inline">{view === "suppliers" ? text.search : text.searchIngredients}</span>
              </Button>
              {appliedQuery ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setQuery("");
                    setAppliedQuery("");
                  }}
                >
                  {text.clear}
                </Button>
              ) : null}
            </form>
            {view === "suppliers" ? (
              <Button type="button" onClick={openCreateSupplier}>
                <Plus className="size-4" />
                {text.addSupplier}
              </Button>
            ) : null}
          </div>
        </header>

        <div className="mb-4 inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-1" role="tablist" aria-label={text.title}>
          <button
            type="button"
            role="tab"
            aria-selected={view === "suppliers"}
            className={cn(
              "flex h-9 items-center gap-2 rounded-md px-3 text-sm transition-colors",
              view === "suppliers" ? "bg-[var(--card)] font-medium text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]",
            )}
            onClick={() => changeView("suppliers")}
          >
            <Building2 className="size-4" />
            {text.supplierView}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "ingredients"}
            className={cn(
              "flex h-9 items-center gap-2 rounded-md px-3 text-sm transition-colors",
              view === "ingredients" ? "bg-[var(--card)] font-medium text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]",
            )}
            onClick={() => changeView("ingredients")}
          >
            <Wheat className="size-4" />
            {text.ingredientView}
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-rose-300 bg-[var(--danger-soft)] px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {view === "suppliers" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs font-semibold text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">{text.supplier}</th>
                  <th className="px-4 py-3">{text.address}</th>
                  <th className="px-4 py-3">{text.contact}</th>
                  <th className="px-4 py-3">{text.suppliedCount}</th>
                  <th className="px-4 py-3">{text.notes}</th>
                  <th className="w-32 px-4 py-3 text-right">{text.actions}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center text-[var(--muted)]">
                      {text.loading}
                    </td>
                  </tr>
                ) : supplierPagination.pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center text-[var(--muted)]">
                      {text.empty}
                    </td>
                  </tr>
                ) : (
                  supplierPagination.pageItems.map((supplier) => (
                    <tr
                      key={supplier.id}
                      tabIndex={0}
                      className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)] focus:outline-none"
                      onClick={() => setSelectedSupplierId(supplier.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedSupplierId(supplier.id);
                        }
                      }}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                            <Building2 className="size-[18px]" />
                          </span>
                          <span className="font-semibold">{supplier.name}</span>
                        </div>
                      </td>
                      <td className="max-w-56 px-4 py-4 text-[var(--muted)]">
                        <span className="line-clamp-2">
                          {supplier.address || text.noAddress}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <ContactSummary supplier={supplier} fallback={text.noContact} />
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)]">
                          {text.ingredients(supplier.supplied_ingredient_count)}
                        </span>
                      </td>
                      <td className="max-w-64 px-4 py-4 text-[var(--muted)]">
                        <span className="line-clamp-2">
                          {supplier.notes || text.noNotes}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title={text.view}
                            aria-label={`${text.view}: ${supplier.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedSupplierId(supplier.id);
                            }}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title={text.edit}
                            aria-label={`${text.edit}: ${supplier.name}`}
                            onClick={(event) => openEditSupplier(supplier, event)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DataPagination
            locale={locale}
            page={supplierPagination.page}
            pageCount={supplierPagination.pageCount}
            pageSize={supplierPagination.pageSize}
            totalItems={supplierRows.length}
            onPageChange={supplierPagination.setPage}
            onPageSizeChange={supplierPagination.setPageSize}
          />
        </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-[var(--surface-muted)] text-xs font-semibold text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3">{text.ingredient}</th>
                    <th className="px-4 py-3">{text.specification}</th>
                    <th className="px-4 py-3">{text.unitPrice}</th>
                    <th className="px-4 py-3">{text.supplier}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-14 text-center text-[var(--muted)]">{text.loading}</td>
                    </tr>
                  ) : ingredientPagination.pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-14 text-center text-[var(--muted)]">{text.allIngredientsEmpty}</td>
                    </tr>
                  ) : ingredientPagination.pageItems.map((row) => (
                    <tr
                      key={row.key}
                      tabIndex={row.supplier ? 0 : undefined}
                      className={cn(
                        "border-t border-[var(--border)]",
                        row.supplier && "cursor-pointer transition-colors hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)] focus:outline-none",
                        row.term && !row.term.is_active && "opacity-55",
                      )}
                      onClick={() => row.supplier && setSelectedSupplierId(row.supplier.id)}
                      onKeyDown={(event) => {
                        if (row.supplier && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          setSelectedSupplierId(row.supplier.id);
                        }
                      }}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.ingredient.name}</span>
                          {row.term?.is_preferred ? <Star className="size-4 fill-amber-400 text-amber-500" aria-label={text.preferred} /> : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {row.term ? (
                          <div>
                            <p>{trimDecimal(row.term.minimum_order_quantity)} {row.term.minimum_order_unit} MOQ</p>
                            <p className="mt-0.5 text-xs text-[var(--muted)]">{text.priceUnit(row.term.price_unit)}</p>
                          </div>
                        ) : <span className="text-[var(--muted)]">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-medium">
                        {row.term ? `${formatMoney(row.term.unit_price, row.term.currency, locale)} / ${row.term.price_unit}` : "—"}
                      </td>
                      <td className="px-4 py-4">
                        {row.supplier ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="size-4 shrink-0 text-[var(--muted)]" />
                            <span>{row.supplier.name}</span>
                            {row.term && !row.term.is_active ? (
                              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--muted)]">{text.inactive}</span>
                            ) : null}
                          </div>
                        ) : <span className="text-[var(--muted)]">{text.supplierNotConfigured}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DataPagination
              locale={locale}
              page={ingredientPagination.page}
              pageCount={ingredientPagination.pageCount}
              pageSize={ingredientPagination.pageSize}
              totalItems={ingredientRows.length}
              onPageChange={ingredientPagination.setPage}
              onPageSizeChange={ingredientPagination.setPageSize}
            />
          </Card>
        )}
      </main>

      {selectedSupplier ? (
        <SupplierDrawer
          supplier={selectedSupplier}
          locale={locale}
          text={text}
          operatingId={operatingId}
          onClose={() => setSelectedSupplierId(null)}
          onEditSupplier={() => openEditSupplier(selectedSupplier)}
          onAddIngredient={openCreateTerm}
          onEditIngredient={openEditTerm}
          onSetPreferred={(item) =>
            void updateTermStatus(
              item,
              { is_preferred: true },
              text.preferredSaved,
            )
          }
          onToggleActive={(item) =>
            void updateTermStatus(
              item,
              { is_active: !item.is_active },
              text.statusSaved,
            )
          }
        />
      ) : null}

      {supplierEditor !== undefined ? (
        <SupplierFormModal
          title={
            supplierEditor ? text.editSupplierTitle : text.createSupplierTitle
          }
          text={text}
          form={supplierForm}
          saving={saving}
          onChange={setSupplierForm}
          onClose={() => setSupplierEditor(undefined)}
          onSubmit={saveSupplier}
        />
      ) : null}

      {termEditor !== undefined && selectedSupplier ? (
        <TermFormModal
          title={termEditor ? text.editIngredientTitle : text.addIngredientTitle}
          text={text}
          form={termForm}
          options={availableIngredientOptions}
          saving={saving}
          editing={Boolean(termEditor)}
          onChange={setTermForm}
          onClose={() => setTermEditor(undefined)}
          onSubmit={saveTerm}
        />
      ) : null}
    </DashboardShell>
  );
}

type LocalisedText = (typeof copy)[keyof typeof copy];

function SupplierDrawer({
  supplier,
  locale,
  text,
  operatingId,
  onClose,
  onEditSupplier,
  onAddIngredient,
  onEditIngredient,
  onSetPreferred,
  onToggleActive,
}: {
  supplier: Supplier;
  locale: "zh-CN" | "en-GB";
  text: LocalisedText;
  operatingId: string | null;
  onClose: () => void;
  onEditSupplier: () => void;
  onAddIngredient: () => void;
  onEditIngredient: (item: SupplierIngredient) => void;
  onSetPreferred: (item: SupplierIngredient) => void;
  onToggleActive: (item: SupplierIngredient) => void;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/30" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={text.close}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-5xl flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl"
      >
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-[var(--border)] px-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="supplier-drawer-title" className="truncate text-lg font-semibold">
              {supplier.name}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {text.ingredients(supplier.supplied_ingredient_count)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" variant="outline" onClick={onEditSupplier}>
              <Pencil className="size-4" />
              {text.edit}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={text.close}
              title={text.close}
              onClick={onClose}
            >
              <X className="size-5" />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <section>
            <h3 className="text-sm font-semibold">{text.basicInfo}</h3>
            <div className="mt-3 grid border-y border-[var(--border)] sm:grid-cols-2 xl:grid-cols-3">
              <InfoItem icon={MapPin} label={text.address} value={supplier.address || text.noAddress} />
              <InfoItem icon={UserRound} label={text.contactName} value={supplier.contact_name || text.noContact} />
              <InfoItem icon={Phone} label={text.phone} value={supplier.phone || text.noContact} />
              <InfoItem icon={Mail} label={text.email} value={supplier.email || text.noContact} />
              <InfoItem icon={PackageOpen} label={text.notes} value={supplier.notes || text.noNotes} wide />
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{text.suppliedIngredients}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">{text.duplicateHint}</p>
              </div>
              <Button type="button" variant="outline" onClick={onAddIngredient}>
                <Plus className="size-4" />
                {text.addIngredient}
              </Button>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="bg-[var(--surface-muted)] text-xs font-semibold text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-3">{text.ingredient}</th>
                    <th className="px-3 py-3">{text.unitPrice}</th>
                    <th className="px-3 py-3">{text.moq}</th>
                    <th className="px-3 py-3">{text.leadTime}</th>
                    <th className="px-3 py-3">{text.ingredientNotes}</th>
                    <th className="px-3 py-3">{text.status}</th>
                    <th className="w-36 px-3 py-3 text-right">{text.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.supplied_ingredients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-[var(--muted)]">
                        {text.noIngredients}
                      </td>
                    </tr>
                  ) : (
                    supplier.supplied_ingredients.map((item) => (
                      <tr
                        key={item.id}
                        className={cn(
                          "border-t border-[var(--border)]",
                          !item.is_active && "opacity-55",
                        )}
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.ingredient_name}</span>
                            {item.is_preferred ? (
                              <Star
                                className="size-4 fill-amber-400 text-amber-500"
                                aria-label={text.preferred}
                              />
                            ) : null}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-medium">
                          {formatMoney(item.unit_price, item.currency, locale)} / {item.price_unit}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {trimDecimal(item.minimum_order_quantity)} {item.minimum_order_unit}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {item.lead_time_days === 0
                            ? text.sameDay
                            : text.days(item.lead_time_days)}
                        </td>
                        <td className="max-w-52 px-3 py-3 text-[var(--muted)]">
                          <span className="line-clamp-2">{item.notes || text.noNotes}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
                              item.is_active
                                ? "bg-[var(--success-soft)] text-emerald-600"
                                : "bg-[var(--surface-muted)] text-[var(--muted)]",
                            )}
                          >
                            {item.is_active ? text.active : text.inactive}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            {!item.is_preferred && item.is_active ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title={text.setPreferred}
                                aria-label={`${text.setPreferred}: ${item.ingredient_name}`}
                                disabled={operatingId === item.id}
                                onClick={() => onSetPreferred(item)}
                              >
                                <Star className="size-4" />
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title={text.edit}
                              aria-label={`${text.edit}: ${item.ingredient_name}`}
                              onClick={() => onEditIngredient(item)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title={item.is_active ? text.disable : text.enable}
                              aria-label={`${item.is_active ? text.disable : text.enable}: ${item.ingredient_name}`}
                              disabled={operatingId === item.id}
                              onClick={() => onToggleActive(item)}
                            >
                              {item.is_active ? (
                                <Ban className="size-4" />
                              ) : (
                                <RotateCcw className="size-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function SupplierFormModal({
  title,
  text,
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  title: string;
  text: LocalisedText;
  form: SupplierInput;
  saving: boolean;
  onChange: (form: SupplierInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <Field label={text.name}>
          <input required maxLength={160} className={inputClass} value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} />
        </Field>
        <Field label={text.contactName}>
          <input maxLength={120} className={inputClass} value={form.contact_name} onChange={(event) => onChange({ ...form, contact_name: event.target.value })} />
        </Field>
        <Field label={text.phone}>
          <input maxLength={40} className={inputClass} value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} />
        </Field>
        <Field label={text.email}>
          <input type="email" maxLength={254} className={inputClass} value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} />
        </Field>
        <Field label={text.address} wide>
          <textarea rows={3} className={textareaClass} value={form.address} onChange={(event) => onChange({ ...form, address: event.target.value })} />
        </Field>
        <Field label={text.notes} wide>
          <textarea rows={3} className={textareaClass} value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
        </Field>
        <ModalActions saving={saving} text={text} onClose={onClose} />
      </form>
    </Modal>
  );
}

function TermFormModal({
  title,
  text,
  form,
  options,
  saving,
  editing,
  onChange,
  onClose,
  onSubmit,
}: {
  title: string;
  text: LocalisedText;
  form: SupplierIngredientInput;
  options: IngredientOption[];
  saving: boolean;
  editing: boolean;
  onChange: (form: SupplierIngredientInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal title={title} onClose={onClose} wide>
      <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={onSubmit}>
        <Field label={text.ingredient} wide>
          <select
            required
            disabled={editing}
            className={inputClass}
            value={form.ingredient}
            onChange={(event) => {
              const option = options.find((item) => item.id === event.target.value);
              onChange({
                ...form,
                ingredient: event.target.value,
                price_unit: unitFor(option),
                minimum_order_unit: unitFor(option),
              });
            }}
          >
            <option value="">{text.selectIngredient}</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          {!editing && options.length === 0 ? (
            <span className="mt-1 block text-xs text-rose-600">{text.ingredientUnavailable}</span>
          ) : null}
        </Field>
        <Field label={text.price}>
          <input required type="number" min="0.0001" step="0.0001" className={inputClass} value={form.unit_price} onChange={(event) => onChange({ ...form, unit_price: event.target.value })} />
        </Field>
        <Field label={text.currency}>
          <input readOnly className={cn(inputClass, "bg-[var(--surface-muted)]")} value={form.currency} />
        </Field>
        <Field label={text.unit}>
          <input required maxLength={24} className={inputClass} value={form.price_unit} onChange={(event) => onChange({ ...form, price_unit: event.target.value })} />
        </Field>
        <Field label={text.minimumOrderQuantity}>
          <input required type="number" min="0.001" step="0.001" className={inputClass} value={form.minimum_order_quantity} onChange={(event) => onChange({ ...form, minimum_order_quantity: event.target.value })} />
        </Field>
        <Field label={text.minimumOrderUnit}>
          <input required maxLength={24} className={inputClass} value={form.minimum_order_unit} onChange={(event) => onChange({ ...form, minimum_order_unit: event.target.value })} />
        </Field>
        <Field label={text.leadTimeDays}>
          <div className="relative">
            <Clock3 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <input required type="number" min="0" max="365" step="1" className={cn(inputClass, "pl-9")} value={form.lead_time_days} onChange={(event) => onChange({ ...form, lead_time_days: Number(event.target.value) })} />
          </div>
        </Field>
        <Field label={text.ingredientNotes} wide>
          <textarea rows={3} maxLength={255} className={textareaClass} value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
        </Field>
        <div className="flex flex-col justify-end gap-3 text-sm sm:col-span-2 lg:col-span-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={(event) => onChange({ ...form, is_active: event.target.checked, is_preferred: event.target.checked ? form.is_preferred : false })} />
              {text.activeLabel}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" disabled={!form.is_active} checked={form.is_preferred} onChange={(event) => onChange({ ...form, is_preferred: event.target.checked })} />
              {text.preferredLabel}
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>{text.cancel}</Button>
            <Button type="submit" disabled={saving || !form.ingredient}>{text.save}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/35 p-4" role="presentation">
      <button type="button" className="absolute inset-0 cursor-default" aria-label={title} onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-label={title} className={cn("relative max-h-[90vh] w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-2xl", wide ? "max-w-4xl" : "max-w-2xl")}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button type="button" variant="ghost" size="icon" aria-label={title} onClick={onClose}><X className="size-5" /></Button>
        </header>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}

function ModalActions({ saving, text, onClose }: { saving: boolean; text: LocalisedText; onClose: () => void }) {
  return (
    <div className="flex justify-end gap-2 sm:col-span-2">
      <Button type="button" variant="outline" onClick={onClose}>{text.cancel}</Button>
      <Button type="submit" disabled={saving}>{text.save}</Button>
    </div>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={cn("block space-y-1.5 text-sm font-medium", wide && "sm:col-span-2 lg:col-span-3")}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function InfoItem({ icon: Icon, label, value, wide = false }: { icon: typeof MapPin; label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("flex min-w-0 gap-3 border-b border-[var(--border)] px-1 py-4 sm:px-3", wide && "sm:col-span-2")}>
      <Icon className="mt-0.5 size-4 shrink-0 text-[var(--muted)]" />
      <div className="min-w-0">
        <p className="text-xs text-[var(--muted)]">{label}</p>
        <p className="mt-1 break-words text-sm">{value}</p>
      </div>
    </div>
  );
}

function ContactSummary({ supplier, fallback }: { supplier: Supplier; fallback: string }) {
  if (!supplier.phone && !supplier.email && !supplier.contact_name) {
    return <span className="text-[var(--muted)]">{fallback}</span>;
  }
  return (
    <div className="space-y-1">
      {supplier.contact_name ? <p className="font-medium">{supplier.contact_name}</p> : null}
      {supplier.phone ? <p className="text-xs text-[var(--muted)]">{supplier.phone}</p> : null}
      {supplier.email ? <p className="max-w-52 truncate text-xs text-[var(--muted)]">{supplier.email}</p> : null}
    </div>
  );
}

function formatMoney(value: string, currency: string, locale: "zh-CN" | "en-GB") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(value));
}

function trimDecimal(value: string) {
  return value.replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, "");
}

function unitFor(option?: IngredientOption) {
  if (!option) return "kg";
  return option.base_unit === "ml" ? "litre" : option.base_unit === "g" ? "kg" : option.base_unit;
}

const inputClass = "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)] disabled:cursor-not-allowed disabled:opacity-60";
const textareaClass = "w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)]";
