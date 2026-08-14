"use client";

import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  Factory,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataPagination, useDataPagination } from "@/components/ui/data-pagination";
import {
  createInventoryReceipt,
  getInventoryOverview,
  getSuppliers,
  type InventoryForecastItem,
  type InventoryOverview,
  type InventoryPurchaseStatus,
  type Supplier,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const copy = {
  "zh-CN": {
    title: "库存管理",
    description: "按未来14天真实生产计划逐日计算食材需求、库存覆盖和采购时点",
    ingredients: "库存食材",
    purchaseRequired: "需采购",
    shortageSevenDays: "7天内可能缺货",
    noDemand: "无计划需求库存",
    ingredient: "食材",
    currentStock: "当前库存",
    demand14Days: "未来14天计划需求",
    dailyDemand: "生产日日均需求",
    productionDays: "计划生产日",
    available: "可覆盖生产日",
    shortageDate: "预计不足日期",
    unit: "单位",
    purchaseStatus: "采购状态",
    days: (value: number) => `${value}天`,
    productionDayValue: (value: number) => `${value}天`,
    allProductionDays: (value: number) => `全部${value}天`,
    sufficientInWindow: "计划期内充足",
    noDays: "—",
    search: "搜索食材",
    allStatuses: "全部状态",
    loading: "正在计算库存预测...",
    empty: "没有符合条件的食材",
    loadError: "库存预测加载失败",
    refresh: "刷新预测",
    close: "关闭",
    currentDemand: "库存与需求",
    stockoutDate: "预计不足日期",
    orderDate: "建议采购日期",
    today: "今天",
    demandSources: "需求来源",
    noDemandSources: "未来14天暂无生产需求",
    dailyDemandDetails: "逐日计划需求",
    remainingAfter: "扣减后预计库存",
    covered: "可覆盖",
    insufficient: "库存不足",
    coverageConclusion: "当前库存足以覆盖未来14天已制定的生产计划",
    recommendedPurchase: "推荐采购",
    preferredSupplier: "首选供应商",
    price: "价格",
    leadTime: "Lead Time",
    moq: "MOQ",
    safetyBuffer: "安全缓冲",
    suggestedQuantity: "建议采购量",
    receivePurchase: "采购入库",
    receiptTitle: "采购入库",
    receiptQuantity: "本次入库数量",
    receiptSupplier: "供应商",
    receiptUnitPrice: "成本单价",
    receiptTime: "采购时间",
    receiptNotes: "入库备注",
    receiptNotesPlaceholder: "例如：已验收，包装完好",
    receiving: "正在入库...",
    confirmReceipt: "确认入库",
    cancel: "取消",
    noSupplier: "尚未配置有效供应商",
    receiptCreated: (reference: string) => `入库单 ${reference} 已完成，库存已更新`,
    receiptError: "采购入库失败",
    calculatedAt: "预测更新时间",
    statuses: {
      NORMAL: "正常",
      WATCH: "关注",
      PURCHASE_REQUIRED: "需要采购",
      EMERGENCY: "紧急",
      NO_DEMAND: "无计划需求",
    },
  },
  "en-GB": {
    title: "Inventory Management",
    description: "Simulate ingredient demand, stock coverage and purchasing dates from real plans over the next 14 days",
    ingredients: "Stocked ingredients",
    purchaseRequired: "Purchase required",
    shortageSevenDays: "May run out in 7 days",
    noDemand: "Stock with no planned demand",
    ingredient: "Ingredient",
    currentStock: "Current stock",
    demand14Days: "Planned demand, 14 days",
    dailyDemand: "Average per production day",
    productionDays: "Production days",
    available: "Covered production days",
    shortageDate: "Expected shortage",
    unit: "Unit",
    purchaseStatus: "Purchase status",
    days: (value: number) => `${value} day${value === 1 ? "" : "s"}`,
    productionDayValue: (value: number) => `${value} day${value === 1 ? "" : "s"}`,
    allProductionDays: (value: number) => `All ${value} day${value === 1 ? "" : "s"}`,
    sufficientInWindow: "Sufficient for planned demand",
    noDays: "—",
    search: "Search ingredients",
    allStatuses: "All statuses",
    loading: "Calculating inventory forecast...",
    empty: "No ingredients match these filters",
    loadError: "Unable to load the inventory forecast",
    refresh: "Refresh forecast",
    close: "Close",
    currentDemand: "Stock and demand",
    stockoutDate: "Expected shortage",
    orderDate: "Recommended order date",
    today: "Today",
    demandSources: "Demand sources",
    noDemandSources: "No production demand in the next 14 days",
    dailyDemandDetails: "Demand by production day",
    remainingAfter: "Projected stock after demand",
    covered: "Covered",
    insufficient: "Insufficient",
    coverageConclusion: "Current stock covers all production plans created for the next 14 days",
    recommendedPurchase: "Recommended purchase",
    preferredSupplier: "Preferred supplier",
    price: "Price",
    leadTime: "Lead time",
    moq: "MOQ",
    safetyBuffer: "Safety buffer",
    suggestedQuantity: "Suggested quantity",
    receivePurchase: "Receive purchase",
    receiptTitle: "Receive purchased stock",
    receiptQuantity: "Quantity received",
    receiptSupplier: "Supplier",
    receiptUnitPrice: "Cost unit price",
    receiptTime: "Purchase time",
    receiptNotes: "Receipt notes",
    receiptNotesPlaceholder: "For example: inspected and accepted",
    receiving: "Receiving...",
    confirmReceipt: "Confirm receipt",
    cancel: "Cancel",
    noSupplier: "No active supplier is configured",
    receiptCreated: (reference: string) => `Goods receipt ${reference} completed and stock updated`,
    receiptError: "Unable to receive the purchased stock",
    calculatedAt: "Forecast updated",
    statuses: {
      NORMAL: "Normal",
      WATCH: "Watch",
      PURCHASE_REQUIRED: "Purchase required",
      EMERGENCY: "Emergency",
      NO_DEMAND: "No planned demand",
    },
  },
} as const;

const statusStyles: Record<InventoryPurchaseStatus, string> = {
  NORMAL: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  WATCH: "bg-yellow-50 text-yellow-800 ring-yellow-200",
  PURCHASE_REQUIRED: "bg-orange-50 text-orange-700 ring-orange-200",
  EMERGENCY: "bg-rose-50 text-rose-700 ring-rose-200",
  NO_DEMAND: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

const statusDotStyles: Record<InventoryPurchaseStatus, string> = {
  NORMAL: "bg-emerald-500",
  WATCH: "bg-yellow-500",
  PURCHASE_REQUIRED: "bg-orange-500",
  EMERGENCY: "bg-rose-500",
  NO_DEMAND: "bg-zinc-400",
};

export function InventoryManagementPage() {
  const { locale } = useAppPreferences();
  const { showInfo } = useToast();
  const text = copy[locale];
  const [overview, setOverview] = useState<InventoryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InventoryPurchaseStatus | "ALL">("ALL");
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);
  const [receiptItem, setReceiptItem] = useState<InventoryForecastItem | null>(null);
  const [receiptQuantity, setReceiptQuantity] = useState("");
  const [receiptSupplierId, setReceiptSupplierId] = useState("");
  const [receiptUnitPrice, setReceiptUnitPrice] = useState("");
  const [receiptTime, setReceiptTime] = useState("");
  const [receiptNotes, setReceiptNotes] = useState("");
  const [receiving, setReceiving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await getInventoryOverview());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [text.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOverview(), 0);
    return () => window.clearTimeout(timer);
  }, [loadOverview]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredItems = useMemo(() => {
    const normalisedQuery = query.trim().toLocaleLowerCase(locale);
    return (overview?.items ?? []).filter((item) => {
      const matchesQuery = !normalisedQuery || item.ingredient_name.toLocaleLowerCase(locale).includes(normalisedQuery);
      return matchesQuery && (statusFilter === "ALL" || item.status === statusFilter);
    });
  }, [locale, overview?.items, query, statusFilter]);
  const pagination = useDataPagination(filteredItems);
  const selectedItem = overview?.items.find((item) => item.ingredient_id === selectedIngredientId) ?? null;
  const receiptSupplierOptions = useMemo(
    () => suppliers
      .map((supplier) => ({
        supplier,
        term: supplier.supplied_ingredients.find(
          (term) => term.ingredient === receiptItem?.ingredient_id && term.is_active,
        ),
      }))
      .filter((option): option is { supplier: Supplier; term: Supplier["supplied_ingredients"][number] } => Boolean(option.term)),
    [receiptItem?.ingredient_id, suppliers],
  );

  function openReceipt(item: InventoryForecastItem) {
    const suggestedQuantity = item.recommended_order_quantity && Number(item.recommended_order_quantity) > 0
      ? item.recommended_order_quantity
      : "1";
    setReceiptItem(item);
    setReceiptQuantity(suggestedQuantity);
    const preferredSupplier = suppliers.find((supplier) => supplier.id === item.supplier?.supplier_id);
    const preferredTerm = preferredSupplier?.supplied_ingredients.find(
      (term) => term.ingredient === item.ingredient_id && term.is_active,
    );
    const fallback = suppliers
      .map((supplier) => ({
        supplier,
        term: supplier.supplied_ingredients.find(
          (term) => term.ingredient === item.ingredient_id && term.is_active,
        ),
      }))
      .find((option) => option.term);
    setReceiptSupplierId(preferredSupplier?.id ?? fallback?.supplier.id ?? "");
    setReceiptUnitPrice(preferredTerm?.unit_price ?? fallback?.term?.unit_price ?? "");
    setReceiptTime(toDateTimeLocalValue(new Date()));
    setReceiptNotes("");
  }

  function changeReceiptSupplier(supplierId: string) {
    setReceiptSupplierId(supplierId);
    const option = receiptSupplierOptions.find(({ supplier }) => supplier.id === supplierId);
    setReceiptUnitPrice(option?.term.unit_price ?? "");
  }

  async function receivePurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !receiptItem
      || !receiptSupplierId
      || !receiptTime
      || Number(receiptQuantity) <= 0
      || Number(receiptUnitPrice) <= 0
    ) return;
    setReceiving(true);
    try {
      const receipt = await createInventoryReceipt({
        ingredient_id: receiptItem.ingredient_id,
        supplier_id: receiptSupplierId,
        quantity: receiptQuantity,
        unit: receiptItem.unit,
        unit_price: receiptUnitPrice,
        received_at: new Date(receiptTime).toISOString(),
        notes: receiptNotes.trim(),
      });
      setReceiptItem(null);
      showInfo(text.receiptCreated(receipt.reference));
      await loadOverview();
    } catch (receiptError) {
      showInfo(receiptError instanceof Error ? receiptError.message : text.receiptError);
    } finally {
      setReceiving(false);
    }
  }

  const kpis = overview?.kpis;
  const metricItems = [
    { label: text.ingredients, value: kpis?.ingredient_count ?? 0, icon: Boxes, tone: "text-blue-700 bg-blue-50" },
    { label: text.purchaseRequired, value: kpis?.purchase_required_count ?? 0, icon: ShoppingCart, tone: "text-rose-700 bg-rose-50" },
    { label: text.shortageSevenDays, value: kpis?.shortage_within_7_days_count ?? 0, icon: AlertTriangle, tone: "text-orange-700 bg-orange-50" },
    { label: text.noDemand, value: kpis?.no_demand_count ?? 0, icon: PackageCheck, tone: "text-zinc-600 bg-zinc-100" },
  ];

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <PageBreadcrumb fallback={{ zh: text.title, en: text.title }} />
            <p className="mt-1.5 text-sm text-[var(--muted)]">{text.description}</p>
          </div>
          <Button type="button" variant="outline" disabled={loading} onClick={() => void loadOverview()}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            {text.refresh}
          </Button>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={text.title}>
          {metricItems.map(({ label, value, icon: Icon, tone }) => (
            <Card key={label} className="min-h-28 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[var(--muted)] sm:text-sm">{label}</p>
                  <p className="mt-2 text-2xl font-semibold sm:text-3xl">{loading ? "—" : value}</p>
                </div>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", tone)}>
                  <Icon className="size-[18px]" />
                </span>
              </div>
            </Card>
          ))}
        </section>

        {error ? <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  pagination.resetPage();
                }}
                placeholder={text.search}
                aria-label={text.search}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] pr-3 pl-9 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]"
              />
            </label>
            <select
              value={statusFilter}
              aria-label={text.purchaseStatus}
              className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:border-[var(--primary)]"
              onChange={(event) => {
                setStatusFilter(event.target.value as InventoryPurchaseStatus | "ALL");
                pagination.resetPage();
              }}
            >
              <option value="ALL">{text.allStatuses}</option>
              {(Object.keys(text.statuses) as InventoryPurchaseStatus[]).map((status) => (
                <option key={status} value={status}>{text.statuses[status]}</option>
              ))}
            </select>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs font-semibold text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">{text.ingredient}</th>
                  <th className="px-4 py-3">{text.currentStock}</th>
                  <th className="px-4 py-3">{text.demand14Days}</th>
                  <th className="px-4 py-3">{text.dailyDemand}</th>
                  <th className="px-4 py-3">{text.available}</th>
                  <th className="px-4 py-3">{text.shortageDate}</th>
                  <th className="px-4 py-3">{text.purchaseStatus}</th>
                  <th className="px-4 py-3">{text.unit}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-[var(--muted)]">{text.loading}</td></tr>
                ) : pagination.pageItems.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-[var(--muted)]">{text.empty}</td></tr>
                ) : pagination.pageItems.map((item) => (
                  <tr
                    key={item.ingredient_id}
                    tabIndex={0}
                    className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)] focus:outline-none"
                    onClick={() => setSelectedIngredientId(item.ingredient_id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedIngredientId(item.ingredient_id);
                      }
                    }}
                  >
                    <td className="px-4 py-4 font-medium">{item.ingredient_name}</td>
                    <td className="px-4 py-4 tabular-nums">{formatNumber(item.current_stock, locale)}</td>
                    <td className="px-4 py-4 tabular-nums">{formatNumber(item.demand_14_days, locale)}</td>
                    <td className="px-4 py-4 tabular-nums text-[var(--muted)]">
                      {item.average_production_day_demand === null
                        ? text.noDays
                        : formatNumber(item.average_production_day_demand, locale)}
                    </td>
                    <td className="px-4 py-4 tabular-nums">{formatCoverage(item, text)}</td>
                    <td className="px-4 py-4 tabular-nums">
                      {item.shortage_date
                        ? formatOptionalDate(item.shortage_date, locale, text.noDays)
                        : item.production_day_count > 0
                          ? text.sufficientInWindow
                          : text.noDays}
                    </td>
                    <td className="px-4 py-4"><StatusBadge status={item.status} label={text.statuses[item.status]} /></td>
                    <td className="px-4 py-4 text-[var(--muted)]">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-[var(--border)] md:hidden">
            {loading ? (
              <div className="px-4 py-16 text-center text-sm text-[var(--muted)]">{text.loading}</div>
            ) : pagination.pageItems.length === 0 ? (
              <div className="px-4 py-16 text-center text-sm text-[var(--muted)]">{text.empty}</div>
            ) : pagination.pageItems.map((item) => (
              <button
                key={item.ingredient_id}
                type="button"
                className="w-full px-4 py-4 text-left transition-colors hover:bg-[var(--surface-muted)]"
                onClick={() => setSelectedIngredientId(item.ingredient_id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.ingredient_name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {text.currentStock} {formatQuantity(item.current_stock, item.unit, locale)}
                    </p>
                  </div>
                  <StatusBadge status={item.status} label={text.statuses[item.status]} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <MobileValue label={text.demand14Days} value={formatQuantity(item.demand_14_days, item.unit, locale)} />
                  <MobileValue
                    label={text.dailyDemand}
                    value={item.average_production_day_demand === null ? text.noDays : formatQuantity(item.average_production_day_demand, item.unit, locale)}
                  />
                  <MobileValue label={text.available} value={formatCoverage(item, text)} />
                  <MobileValue
                    label={text.shortageDate}
                    value={item.shortage_date ? formatOptionalDate(item.shortage_date, locale, text.noDays) : item.production_day_count ? text.sufficientInWindow : text.noDays}
                  />
                </div>
              </button>
            ))}
          </div>
          <DataPagination
            locale={locale}
            page={pagination.page}
            pageSize={pagination.pageSize}
            pageCount={pagination.pageCount}
            totalItems={filteredItems.length}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </Card>

        {overview ? (
          <p className="mt-3 text-right text-xs text-[var(--muted)]">
            {text.calculatedAt}: {formatDateTime(overview.generated_at, locale)}
          </p>
        ) : null}
      </main>

      {selectedItem ? (
        <InventoryDrawer
          item={selectedItem}
          locale={locale}
          text={text}
          onClose={() => setSelectedIngredientId(null)}
          onReceivePurchase={() => openReceipt(selectedItem)}
        />
      ) : null}

      {receiptItem ? (
        <InventoryReceiptModal
          item={receiptItem}
          locale={locale}
          text={text}
          quantity={receiptQuantity}
          supplierId={receiptSupplierId}
          supplierOptions={receiptSupplierOptions}
          unitPrice={receiptUnitPrice}
          purchaseTime={receiptTime}
          notes={receiptNotes}
          receiving={receiving}
          onQuantityChange={setReceiptQuantity}
          onSupplierChange={changeReceiptSupplier}
          onUnitPriceChange={setReceiptUnitPrice}
          onPurchaseTimeChange={setReceiptTime}
          onNotesChange={setReceiptNotes}
          onClose={() => setReceiptItem(null)}
          onSubmit={receivePurchase}
        />
      ) : null}
    </DashboardShell>
  );
}

type LocalisedText = (typeof copy)[keyof typeof copy];

function InventoryDrawer({
  item,
  locale,
  text,
  onClose,
  onReceivePurchase,
}: {
  item: InventoryForecastItem;
  locale: "zh-CN" | "en-GB";
  text: LocalisedText;
  onClose: () => void;
  onReceivePurchase: () => void;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const orderDateIsToday = item.recommended_order_date === new Date().toISOString().slice(0, 10);
  return (
    <div className="fixed inset-0 z-[60] bg-black/30" role="presentation">
      <button type="button" className="absolute inset-0 cursor-default" aria-label={text.close} onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl"
      >
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-[var(--border)] px-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="inventory-drawer-title" className="truncate text-lg font-semibold">{item.ingredient_name}</h2>
            <div className="mt-1"><StatusBadge status={item.status} label={text.statuses[item.status]} /></div>
          </div>
          <Button type="button" variant="ghost" size="icon" title={text.close} aria-label={text.close} onClick={onClose}>
            <X className="size-5" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <section>
            <h3 className="text-sm font-semibold">{text.currentDemand}</h3>
            <div className="mt-3 grid grid-cols-2 border-y border-[var(--border)] sm:grid-cols-3">
              <InfoValue label={text.currentStock} value={formatQuantity(item.current_stock, item.unit, locale)} />
              <InfoValue label={text.demand14Days} value={formatQuantity(item.demand_14_days, item.unit, locale)} />
              <InfoValue label={text.productionDays} value={item.production_day_count ? text.productionDayValue(item.production_day_count) : text.noDays} />
              <InfoValue
                label={text.dailyDemand}
                value={item.average_production_day_demand === null ? text.noDays : formatQuantity(item.average_production_day_demand, item.unit, locale)}
              />
              <InfoValue label={text.available} value={formatCoverage(item, text)} />
              <InfoValue
                label={text.stockoutDate}
                value={item.shortage_date ? formatOptionalDate(item.shortage_date, locale, text.noDays) : item.production_day_count ? text.sufficientInWindow : text.noDays}
              />
              <InfoValue label={text.orderDate} value={orderDateIsToday ? text.today : formatOptionalDate(item.recommended_order_date, locale, text.noDays)} />
            </div>
            {item.covers_all_planned_demand ? (
              <p className="mt-3 rounded-lg bg-[var(--success-soft)] px-4 py-3 text-sm text-emerald-700">
                {text.coverageConclusion}
              </p>
            ) : null}
          </section>

          <section className="mt-8">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-[var(--primary)]" />
              <h3 className="text-sm font-semibold">{text.dailyDemandDetails}</h3>
            </div>
            {item.daily_demands.length ? (
              <div className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {item.daily_demands.map((daily) => (
                  <div key={daily.date} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-3 text-sm">
                    <span className="font-medium">{formatOptionalDate(daily.date, locale, daily.date)}</span>
                    <span className="tabular-nums font-medium">{formatQuantity(daily.quantity, item.unit, locale)}</span>
                    <span className="text-xs text-[var(--muted)]">{text.remainingAfter}</span>
                    <span className={cn("text-right text-xs tabular-nums", daily.is_covered ? "text-[var(--muted)]" : "text-rose-600")}>
                      {formatQuantity(daily.remaining_stock, item.unit, locale)} · {daily.is_covered ? text.covered : text.insufficient}
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-[var(--muted)]">{text.noDemandSources}</p>}
          </section>

          <section className="mt-8">
            <div className="flex items-center gap-2">
              <Factory className="size-4 text-[var(--primary)]" />
              <h3 className="text-sm font-semibold">{text.demandSources}</h3>
            </div>
            {item.demand_sources.length ? (
              <div className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {item.demand_sources.map((source) => (
                  <div key={source.product_id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span>{locale === "en-GB" ? source.product_name_en : source.product_name_zh}</span>
                    <span className="shrink-0 tabular-nums font-medium">{formatQuantity(source.quantity, source.unit, locale)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-[var(--muted)]">{text.noDemandSources}</p>}
          </section>

          <section className="mt-8">
            <div className="flex items-center gap-2">
              <Truck className="size-4 text-[var(--primary)]" />
              <h3 className="text-sm font-semibold">{text.recommendedPurchase}</h3>
            </div>
            {item.supplier ? (
              <div className="mt-3 grid grid-cols-2 border-y border-[var(--border)]">
                <InfoValue label={text.preferredSupplier} value={item.supplier.supplier_name} />
                <InfoValue label={text.price} value={formatPrice(item.supplier.unit_price, item.supplier.currency, item.supplier.price_unit, locale)} />
                <InfoValue label={text.leadTime} value={text.days(item.supplier.lead_time_days)} />
                <InfoValue label={text.moq} value={formatQuantity(item.supplier.minimum_order_quantity, item.supplier.minimum_order_unit, locale)} />
                <InfoValue label={text.safetyBuffer} value={text.days(item.safety_buffer_days)} />
                <InfoValue label={text.suggestedQuantity} value={item.recommended_order_quantity ? formatQuantity(item.recommended_order_quantity, item.unit, locale) : text.noDays} />
              </div>
            ) : <p className="mt-3 text-sm text-[var(--muted)]">{text.noSupplier}</p>}
          </section>
        </div>

        <footer className="flex items-center justify-end border-t border-[var(--border)] p-4 sm:px-6">
          <Button type="button" onClick={onReceivePurchase}>
            <PackagePlus className="size-4" />
            {text.receivePurchase}
          </Button>
        </footer>
      </aside>
    </div>
  );
}

function InventoryReceiptModal({
  item,
  locale,
  text,
  quantity,
  supplierId,
  supplierOptions,
  unitPrice,
  purchaseTime,
  notes,
  receiving,
  onQuantityChange,
  onSupplierChange,
  onUnitPriceChange,
  onPurchaseTimeChange,
  onNotesChange,
  onClose,
  onSubmit,
}: {
  item: InventoryForecastItem;
  locale: "zh-CN" | "en-GB";
  text: LocalisedText;
  quantity: string;
  supplierId: string;
  supplierOptions: Array<{
    supplier: Supplier;
    term: Supplier["supplied_ingredients"][number];
  }>;
  unitPrice: string;
  purchaseTime: string;
  notes: string;
  receiving: boolean;
  onQuantityChange: (value: string) => void;
  onSupplierChange: (value: string) => void;
  onUnitPriceChange: (value: string) => void;
  onPurchaseTimeChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const selectedSupplier = supplierOptions.find(({ supplier }) => supplier.id === supplierId);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !receiving) onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, receiving]);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/35 p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={text.cancel}
        disabled={receiving}
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-receipt-title"
        className="relative w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 id="inventory-receipt-title" className="text-base font-semibold">{text.receiptTitle}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{item.ingredient_name}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={text.close} disabled={receiving} onClick={onClose}>
            <X className="size-5" />
          </Button>
        </header>
        <form className="space-y-5 p-5" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-4 border-y border-[var(--border)] py-4">
            <InfoValue label={text.currentStock} value={formatQuantity(item.current_stock, item.unit, locale)} />
            <InfoValue label={text.preferredSupplier} value={item.supplier?.supplier_name ?? text.noSupplier} />
          </div>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>{text.receiptQuantity}</span>
            <div className="flex">
              <input
                required
                autoFocus
                type="number"
                inputMode="decimal"
                min="0.001"
                step="0.001"
                value={quantity}
                disabled={receiving}
                className="h-10 min-w-0 flex-1 rounded-l-lg border border-r-0 border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]"
                onChange={(event) => onQuantityChange(event.target.value)}
              />
              <span className="grid h-10 min-w-14 place-items-center rounded-r-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--muted)]">
                {item.unit}
              </span>
            </div>
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>{text.receiptSupplier}</span>
            <select
              required
              value={supplierId}
              disabled={receiving}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]"
              onChange={(event) => onSupplierChange(event.target.value)}
            >
              <option value="">{text.noSupplier}</option>
              {supplierOptions.map(({ supplier }) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-medium">
              <span>{text.receiptUnitPrice}</span>
              <div className="flex">
                <span className="grid h-10 place-items-center rounded-l-lg border border-r-0 border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--muted)]">
                  {selectedSupplier?.term.currency ?? "GBP"}
                </span>
                <input
                  required
                  type="number"
                  inputMode="decimal"
                  min="0.0001"
                  step="0.0001"
                  value={unitPrice}
                  disabled={receiving}
                  className="h-10 min-w-0 flex-1 border border-r-0 border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]"
                  onChange={(event) => onUnitPriceChange(event.target.value)}
                />
                <span className="grid h-10 place-items-center rounded-r-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--muted)]">
                  /{selectedSupplier?.term.price_unit ?? item.unit}
                </span>
              </div>
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>{text.receiptTime}</span>
              <input
                required
                type="datetime-local"
                value={purchaseTime}
                disabled={receiving}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]"
                onChange={(event) => onPurchaseTimeChange(event.target.value)}
              />
            </label>
          </div>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>{text.receiptNotes}</span>
            <textarea
              rows={3}
              maxLength={255}
              value={notes}
              disabled={receiving}
              placeholder={text.receiptNotesPlaceholder}
              className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]"
              onChange={(event) => onNotesChange(event.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={receiving} onClick={onClose}>{text.cancel}</Button>
            <Button
              type="submit"
              disabled={
                receiving
                || !quantity
                || Number(quantity) <= 0
                || !supplierId
                || !unitPrice
                || Number(unitPrice) <= 0
                || !purchaseTime
              }
            >
              <PackagePlus className="size-4" />
              {receiving ? text.receiving : text.confirmReceipt}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function StatusBadge({ status, label }: { status: InventoryPurchaseStatus; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", statusStyles[status])}>
      <span className={cn("size-2 rounded-full", statusDotStyles[status])} />
      {label}
    </span>
  );
}

function InfoValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-[var(--border)] p-3 last:border-b-0 sm:p-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function MobileValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 truncate font-medium tabular-nums text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function formatQuantity(value: string, unit: string, locale: "zh-CN" | "en-GB") {
  return `${formatNumber(value, locale)}${unit}`;
}

function formatNumber(value: string, locale: "zh-CN" | "en-GB") {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(number)
    : value;
}

function formatCoverage(item: InventoryForecastItem, text: LocalisedText) {
  if (item.covered_production_days === null) return text.noDays;
  if (item.covers_all_planned_demand) return text.allProductionDays(item.production_day_count);
  return text.productionDayValue(item.covered_production_days);
}

function formatOptionalDate(value: string | null, locale: "zh-CN" | "en-GB", fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string, locale: "zh-CN" | "en-GB") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatPrice(value: string, currency: string, unit: string, locale: "zh-CN" | "en-GB") {
  return `${new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(value))}/${unit}`;
}

function toDateTimeLocalValue(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}
