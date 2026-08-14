"use client";

import {
  ClipboardList,
  PackageCheck,
  PoundSterling,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataPagination, useDataPagination } from "@/components/ui/data-pagination";
import { getInventoryReceipts, type InventoryReceipt } from "@/lib/api";
import { cn } from "@/lib/utils";

const copy = {
  "zh-CN": {
    title: "进货记录",
    description: "查看库存采购入库形成的历史记录",
    receiptCount: "入库记录",
    totalCost: "采购金额",
    suppliers: "涉及供应商",
    ingredients: "入库食材",
    search: "搜索入库单号、食材、供应商或备注",
    startDate: "开始日期",
    endDate: "结束日期",
    clear: "清除筛选",
    refresh: "刷新记录",
    reference: "入库单号",
    purchasedAt: "采购时间",
    ingredient: "食材",
    quantity: "入库数量",
    unitPrice: "成本单价",
    amount: "采购金额",
    supplier: "供应商",
    recordedBy: "录入人",
    notes: "备注",
    loading: "正在读取进货记录...",
    empty: "没有符合条件的进货记录",
    loadError: "进货记录加载失败",
    unknown: "—",
  },
  "en-GB": {
    title: "Goods Receipts",
    description: "Review historical purchases received into inventory",
    receiptCount: "Receipts",
    totalCost: "Purchase value",
    suppliers: "Suppliers",
    ingredients: "Ingredients received",
    search: "Search receipt, ingredient, supplier or notes",
    startDate: "Start date",
    endDate: "End date",
    clear: "Clear filters",
    refresh: "Refresh records",
    reference: "Receipt",
    purchasedAt: "Purchase time",
    ingredient: "Ingredient",
    quantity: "Quantity received",
    unitPrice: "Cost unit price",
    amount: "Purchase value",
    supplier: "Supplier",
    recordedBy: "Recorded by",
    notes: "Notes",
    loading: "Loading goods receipts...",
    empty: "No goods receipts match these filters",
    loadError: "Unable to load goods receipts",
    unknown: "—",
  },
} as const;

export function InventoryReceiptsPage() {
  const { locale } = useAppPreferences();
  const text = copy[locale];
  const [receipts, setReceipts] = useState<InventoryReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReceipts(await getInventoryReceipts());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [text.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReceipts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadReceipts]);

  const filteredReceipts = useMemo(() => {
    const normalisedQuery = query.trim().toLocaleLowerCase(locale);
    return receipts.filter((receipt) => {
      const purchasedDate = receipt.received_at.slice(0, 10);
      const matchesQuery = !normalisedQuery || [
        receipt.reference,
        receipt.ingredient_name,
        receipt.supplier_name ?? "",
        receipt.notes,
      ].some((value) => value.toLocaleLowerCase(locale).includes(normalisedQuery));
      return matchesQuery
        && (!startDate || purchasedDate >= startDate)
        && (!endDate || purchasedDate <= endDate);
    });
  }, [endDate, locale, query, receipts, startDate]);
  const pagination = useDataPagination(filteredReceipts);
  const totalCost = filteredReceipts.reduce(
    (sum, receipt) => sum + Number(receipt.total_cost ?? 0),
    0,
  );
  const metrics = [
    { label: text.receiptCount, value: filteredReceipts.length, icon: ClipboardList, tone: "bg-blue-50 text-blue-700" },
    { label: text.totalCost, value: formatCurrency(totalCost, "GBP", locale), icon: PoundSterling, tone: "bg-emerald-50 text-emerald-700" },
    { label: text.suppliers, value: new Set(filteredReceipts.map((item) => item.supplier_id).filter(Boolean)).size, icon: Truck, tone: "bg-amber-50 text-amber-700" },
    { label: text.ingredients, value: new Set(filteredReceipts.map((item) => item.ingredient_id)).size, icon: PackageCheck, tone: "bg-violet-50 text-violet-700" },
  ];

  function clearFilters() {
    setQuery("");
    setStartDate("");
    setEndDate("");
    pagination.resetPage();
  }

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <PageBreadcrumb fallback={{ zh: text.title, en: text.title }} />
            <p className="mt-1.5 text-sm text-[var(--muted)]">{text.description}</p>
          </div>
          <Button type="button" variant="outline" disabled={loading} onClick={() => void loadReceipts()}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            {text.refresh}
          </Button>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={text.title}>
          {metrics.map(({ label, value, icon: Icon, tone }) => (
            <Card key={label} className="min-h-28 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--muted)] sm:text-sm">{label}</p>
                  <p className="mt-2 truncate text-2xl font-semibold sm:text-3xl">{loading ? "—" : value}</p>
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
          <div className="grid gap-3 border-b border-[var(--border)] p-4 lg:grid-cols-[minmax(240px,1fr)_180px_180px_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="search"
                value={query}
                placeholder={text.search}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] pr-3 pl-9 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]"
                onChange={(event) => {
                  setQuery(event.target.value);
                  pagination.resetPage();
                }}
              />
            </label>
            <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-sm text-[var(--muted)] lg:grid-cols-1 lg:gap-1">
              <span>{text.startDate}</span>
              <input type="date" value={startDate} className="h-10 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]" onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-sm text-[var(--muted)] lg:grid-cols-1 lg:gap-1">
              <span>{text.endDate}</span>
              <input type="date" value={endDate} className="h-10 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]" onChange={(event) => setEndDate(event.target.value)} />
            </label>
            <Button type="button" variant="outline" className="self-end" onClick={clearFilters}>{text.clear}</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">{text.purchasedAt}</th>
                  <th className="px-4 py-3 font-medium">{text.reference}</th>
                  <th className="px-4 py-3 font-medium">{text.ingredient}</th>
                  <th className="px-4 py-3 text-right font-medium">{text.quantity}</th>
                  <th className="px-4 py-3 text-right font-medium">{text.unitPrice}</th>
                  <th className="px-4 py-3 text-right font-medium">{text.amount}</th>
                  <th className="px-4 py-3 font-medium">{text.supplier}</th>
                  <th className="px-4 py-3 font-medium">{text.recordedBy}</th>
                  <th className="px-4 py-3 font-medium">{text.notes}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-[var(--muted)]">{text.loading}</td></tr>
                ) : pagination.pageItems.length ? pagination.pageItems.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-[var(--surface-muted)]/60">
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(receipt.received_at, locale)}</td>
                    <td className="px-4 py-3 font-medium">{receipt.reference}</td>
                    <td className="px-4 py-3">{receipt.ingredient_name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(receipt.quantity, locale)} {receipt.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{receipt.unit_price ? `${formatCurrency(Number(receipt.unit_price), receipt.currency, locale)}/${receipt.price_unit}` : text.unknown}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{receipt.total_cost ? formatCurrency(Number(receipt.total_cost), receipt.currency, locale) : text.unknown}</td>
                    <td className="px-4 py-3">{receipt.supplier_name ?? text.unknown}</td>
                    <td className="px-4 py-3">{receipt.created_by_name ?? text.unknown}</td>
                    <td className="max-w-64 truncate px-4 py-3 text-[var(--muted)]" title={receipt.notes}>{receipt.notes || text.unknown}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-[var(--muted)]">{text.empty}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <DataPagination
            locale={locale}
            page={pagination.page}
            pageSize={pagination.pageSize}
            pageCount={pagination.pageCount}
            totalItems={filteredReceipts.length}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </Card>
      </main>
    </DashboardShell>
  );
}

function formatDateTime(value: string, locale: "zh-CN" | "en-GB") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatCurrency(value: number, currency: string, locale: "zh-CN" | "en-GB") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: currency || "GBP" }).format(value);
}

function formatNumber(value: string, locale: "zh-CN" | "en-GB") {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(Number(value));
}
