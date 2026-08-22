"use client";

import {
  ClipboardList,
  Download,
  FileText,
  PackageCheck,
  PoundSterling,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataPagination, useDataPagination } from "@/components/ui/data-pagination";
import { DateInput } from "@/components/ui/date-input";
import {
  bulkDeleteInventoryReceipts,
  getInventoryReceipts,
  getSuppliers,
  getInventoryRecorderOptions,
  updateInventoryReceipt,
  type InventoryReceipt,
  type Supplier,
  type InventoryRecorderOption,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const copy = {
  "zh-CN": {
    title: "进货记录",
    description: "查看并维护库存采购入库形成的历史记录",
    receiptCount: "入库记录",
    totalCost: "采购金额",
    suppliers: "涉及供应商",
    ingredients: "入库食材",
    search: "搜索入库单号、食材、供应商、录入人或备注",
    startDate: "开始日期",
    endDate: "结束日期",
    clear: "清除筛选",
    refresh: "刷新记录",
    reference: "入库单号",
    purchasedAt: "采购日期",
    ingredient: "食材",
    quantity: "入库数量",
    unitPrice: "成本单价",
    amount: "采购金额",
    supplier: "供应商",
    recordedBy: "录入人",
    notes: "备注",
    invoice: "发票附件",
    loading: "正在读取进货记录...",
    empty: "没有符合条件的进货记录",
    loadError: "进货记录加载失败",
    unknown: "—",
    detailTitle: "进货详情",
    close: "关闭",
    cancel: "取消",
    save: "保存修改",
    saving: "正在保存...",
    saved: "进货记录已更新",
    saveError: "进货记录更新失败",
    chooseInvoice: "重新上传发票",
    uploadHint: "支持 PDF、JPG、PNG、WebP，最大 10 MB",
    downloadInvoice: "查看或下载发票",
    removeInvoice: "删除发票",
    invoiceWillBeRemoved: "保存后将删除现有发票",
    replacementSelected: "已选择新发票，保存后替换原附件",
    noInvoice: "未上传发票",
    selected: (count: number) => `已选择 ${count} 条进货记录`,
    selectAll: "全选当前页",
    selectReceipt: (reference: string) => `选择进货记录 ${reference}`,
    deleteSelected: "删除所选",
    deleteConfirm: (count: number) =>
      `确定删除选中的 ${count} 条进货记录吗？对应的库存数量和采购金额将一并回退。`,
    deleted: (count: number) => `已删除 ${count} 条进货记录`,
    deleteError: "进货记录删除失败",
  },
  "en-GB": {
    title: "Goods Receipts",
    description: "Review and maintain historical purchases received into inventory",
    receiptCount: "Receipts",
    totalCost: "Purchase value",
    suppliers: "Suppliers",
    ingredients: "Ingredients received",
    search: "Search receipt, ingredient, supplier, recorder or notes",
    startDate: "Start date",
    endDate: "End date",
    clear: "Clear filters",
    refresh: "Refresh records",
    reference: "Receipt",
    purchasedAt: "Purchase date",
    ingredient: "Ingredient",
    quantity: "Quantity received",
    unitPrice: "Cost unit price",
    amount: "Purchase value",
    supplier: "Supplier",
    recordedBy: "Recorded by",
    notes: "Notes",
    invoice: "Invoice attachment",
    loading: "Loading goods receipts...",
    empty: "No goods receipts match these filters",
    loadError: "Unable to load goods receipts",
    unknown: "—",
    detailTitle: "Goods receipt details",
    close: "Close",
    cancel: "Cancel",
    save: "Save changes",
    saving: "Saving...",
    saved: "Goods receipt updated",
    saveError: "Unable to update the goods receipt",
    chooseInvoice: "Upload replacement invoice",
    uploadHint: "PDF, JPG, PNG or WebP, up to 10 MB",
    downloadInvoice: "View or download invoice",
    removeInvoice: "Remove invoice",
    invoiceWillBeRemoved: "The current invoice will be removed when saved",
    replacementSelected: "A new invoice is selected and will replace the current attachment",
    noInvoice: "No invoice uploaded",
    selected: (count: number) => `${count} goods receipt${count === 1 ? "" : "s"} selected`,
    selectAll: "Select all on this page",
    selectReceipt: (reference: string) => `Select goods receipt ${reference}`,
    deleteSelected: "Delete selected",
    deleteConfirm: (count: number) =>
      `Delete ${count} selected goods receipt${count === 1 ? "" : "s"}? The related inventory quantity and purchase value will be reversed.`,
    deleted: (count: number) => `${count} goods receipt${count === 1 ? "" : "s"} deleted`,
    deleteError: "Unable to delete goods receipts",
  },
} as const;

type ReceiptForm = {
  supplierId: string;
  quantity: string;
  unitPrice: string;
  receivedAt: string;
  notes: string;
  recordedById: string;
  invoice: File | null;
  removeInvoice: boolean;
};

type LocalisedText = (typeof copy)[keyof typeof copy];

function metricValueClass(value: string | number) {
  const length = String(value).length;
  if (length > 18) return "text-base";
  if (length > 14) return "text-lg";
  if (length > 10) return "text-xl";
  return "text-2xl";
}

export function InventoryReceiptsPage() {
  const { locale } = useAppPreferences();
  const { showInfo } = useToast();
  const text = copy[locale];
  const [receipts, setReceipts] = useState<InventoryReceipt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<InventoryRecorderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<InventoryReceipt | null>(null);
  const [form, setForm] = useState<ReceiptForm | null>(null);

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [receiptRows, supplierRows, userRows] = await Promise.all([
        getInventoryReceipts(),
        getSuppliers(),
        getInventoryRecorderOptions(),
      ]);
      setReceipts(receiptRows);
      setSelectedIds([]);
      setSuppliers(supplierRows);
      setEmployees(userRows);
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
      const searchable = [
        receipt.reference,
        receipt.ingredient_name,
        receipt.supplier_name ?? "",
        receipt.recorded_by_name ?? receipt.created_by_name ?? "",
        receipt.notes,
      ].join(" ").toLocaleLowerCase(locale);
      const receiptDate = receipt.received_at.slice(0, 10);
      return (!normalisedQuery || searchable.includes(normalisedQuery))
        && (!startDate || receiptDate >= startDate)
        && (!endDate || receiptDate <= endDate);
    });
  }, [endDate, locale, query, receipts, startDate]);
  const pagination = useDataPagination(filteredReceipts);
  const pageReceiptIds = pagination.pageItems.map((receipt) => receipt.id);
  const allPageSelected = pageReceiptIds.length > 0
    && pageReceiptIds.every((receiptId) => selectedIds.includes(receiptId));
  const somePageSelected = pageReceiptIds.some((receiptId) => selectedIds.includes(receiptId));
  const totalCost = filteredReceipts.reduce((sum, receipt) => sum + Number(receipt.total_cost ?? 0), 0);
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
    setSelectedIds([]);
    pagination.resetPage();
  }

  function togglePageSelection() {
    setSelectedIds((current) => {
      if (allPageSelected) {
        return current.filter((receiptId) => !pageReceiptIds.includes(receiptId));
      }
      return [...new Set([...current, ...pageReceiptIds])];
    });
  }

  async function deleteSelectedReceipts() {
    if (!selectedIds.length || !window.confirm(text.deleteConfirm(selectedIds.length))) return;
    const receiptIds = [...selectedIds];
    setDeleting(true);
    try {
      await bulkDeleteInventoryReceipts(receiptIds);
      setReceipts((current) => current.filter((receipt) => !receiptIds.includes(receipt.id)));
      if (selected && receiptIds.includes(selected.id)) {
        setSelected(null);
        setForm(null);
      }
      setSelectedIds([]);
      showInfo(text.deleted(receiptIds.length));
    } catch (deleteError) {
      showInfo(deleteError instanceof Error ? deleteError.message : text.deleteError);
    } finally {
      setDeleting(false);
    }
  }

  function openReceipt(receipt: InventoryReceipt) {
    setSelected(receipt);
    setForm({
      supplierId: receipt.supplier_id ?? "",
      quantity: receipt.quantity,
      unitPrice: receipt.unit_price ?? "",
      receivedAt: receipt.received_at.slice(0, 10),
      notes: receipt.notes,
      recordedById: receipt.recorded_by_id ?? receipt.created_by_id ?? "",
      invoice: null,
      removeInvoice: false,
    });
  }

  function closeReceipt() {
    if (saving) return;
    setSelected(null);
    setForm(null);
  }

  async function saveReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !form || !form.supplierId || !form.recordedById) return;
    const supplier = suppliers.find((row) => row.id === form.supplierId);
    const term = supplier?.supplied_ingredients.find(
      (row) => row.ingredient === selected.ingredient_id && row.is_active,
    );
    const recordedBy = employees.find((row) => row.id === form.recordedById);
    setSaving(true);
    try {
      const updated = await updateInventoryReceipt(selected.id, {
        supplier_id: form.supplierId,
        supplier_name: supplier?.name,
        quantity: form.quantity,
        unit: selected.unit,
        unit_price: form.unitPrice,
        currency: term?.currency ?? selected.currency,
        price_unit: term?.price_unit ?? selected.price_unit,
        received_at: dateToLocalIso(form.receivedAt),
        notes: form.notes.trim(),
        recorded_by_id: form.recordedById,
        recorded_by_name: recordedBy?.name,
        invoice: form.invoice,
        remove_invoice: form.removeInvoice,
      });
      const merged = { ...selected, ...updated };
      setReceipts((rows) => rows.map((row) => row.id === selected.id ? merged : row));
      setSelected(null);
      setForm(null);
      showInfo(text.saved);
    } catch (saveError) {
      showInfo(saveError instanceof Error ? saveError.message : text.saveError);
    } finally {
      setSaving(false);
    }
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
                  <p className={cn("mt-2 break-words font-semibold tabular-nums leading-tight", metricValueClass(value))} title={String(value)}>
                    {loading ? "—" : value}
                  </p>
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
          <div className="grid items-center gap-3 border-b border-[var(--border)] p-4 lg:grid-cols-[minmax(240px,1fr)_180px_180px_auto]">
            <label className="relative block h-10">
              <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-[var(--muted)]" />
              <input type="search" value={query} placeholder={text.search} className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] pr-3 pl-9 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]" onChange={(event) => { setQuery(event.target.value); setSelectedIds([]); pagination.resetPage(); }} />
            </label>
            <DateInput aria-label={text.startDate} locale={locale} value={startDate} className="h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]" onChange={(value) => { setStartDate(value); setSelectedIds([]); }} />
            <DateInput aria-label={text.endDate} locale={locale} value={endDate} className="h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]" onChange={(value) => { setEndDate(value); setSelectedIds([]); }} />
            <Button type="button" variant="outline" onClick={clearFilters}>{text.clear}</Button>
          </div>

          {selectedIds.length ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--primary-soft)]/45 px-4 py-3">
              <span className="text-sm font-medium text-[var(--foreground)]">{text.selected(selectedIds.length)}</span>
              <Button
                type="button"
                variant="ghost"
                className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                disabled={deleting}
                onClick={() => void deleteSelectedReceipts()}
              >
                <Trash2 className="size-4" />
                {text.deleteSelected}
              </Button>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="w-12 px-4 py-3 font-medium">
                    <input
                      type="checkbox"
                      aria-label={text.selectAll}
                      className="size-4 accent-[var(--primary)]"
                      checked={allPageSelected}
                      ref={(node) => {
                        if (node) node.indeterminate = somePageSelected && !allPageSelected;
                      }}
                      onChange={togglePageSelection}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">{text.purchasedAt}</th>
                  <th className="px-4 py-3 font-medium">{text.reference}</th>
                  <th className="min-w-56 px-4 py-3 font-medium">{text.ingredient}</th>
                  <th className="px-4 py-3 text-right font-medium">{text.quantity}</th>
                  <th className="px-4 py-3 text-right font-medium">{text.unitPrice}</th>
                  <th className="px-4 py-3 text-right font-medium">{text.amount}</th>
                  <th className="px-4 py-3 font-medium">{text.supplier}</th>
                  <th className="min-w-48 px-4 py-3 font-medium">{text.recordedBy}</th>
                  <th className="min-w-60 px-4 py-3 font-medium">{text.invoice}</th>
                  <th className="px-4 py-3 font-medium">{text.notes}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-[var(--muted)]">{text.loading}</td></tr>
                ) : pagination.pageItems.length ? pagination.pageItems.map((receipt) => (
                  <tr
                    key={receipt.id}
                    tabIndex={0}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-[var(--surface-muted)]/60 focus:bg-[var(--surface-muted)]/60 focus:outline-none",
                      selectedIds.includes(receipt.id) && "bg-[var(--primary-soft)]/45",
                    )}
                    onClick={() => openReceipt(receipt)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openReceipt(receipt);
                      }
                    }}
                  >
                    <td
                      className="px-4 py-3"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={text.selectReceipt(receipt.reference)}
                        className="size-4 accent-[var(--primary)]"
                        checked={selectedIds.includes(receipt.id)}
                        onChange={() =>
                          setSelectedIds((current) =>
                            current.includes(receipt.id)
                              ? current.filter((receiptId) => receiptId !== receipt.id)
                              : [...current, receipt.id],
                          )
                        }
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(receipt.received_at, locale)}</td>
                    <td className="px-4 py-3 font-medium">{receipt.reference}</td>
                    <td className="min-w-56 px-4 py-3">{receipt.ingredient_name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(receipt.quantity, locale)} {receipt.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{receipt.unit_price ? `${formatCurrency(Number(receipt.unit_price), receipt.currency, locale)}/${receipt.price_unit}` : text.unknown}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{receipt.total_cost ? formatCurrency(Number(receipt.total_cost), receipt.currency, locale) : text.unknown}</td>
                    <td className="px-4 py-3">{receipt.supplier_name ?? text.unknown}</td>
                    <td className="min-w-48 px-4 py-3">{receipt.recorded_by_name ?? receipt.created_by_name ?? text.unknown}</td>
                    <td className="min-w-60 max-w-72 truncate px-4 py-3 text-[var(--muted)]" title={receipt.invoice_name || undefined}>{receipt.invoice_name || text.unknown}</td>
                    <td className="max-w-64 truncate px-4 py-3 text-[var(--muted)]" title={receipt.notes}>{receipt.notes || text.unknown}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-[var(--muted)]">{text.empty}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <DataPagination locale={locale} page={pagination.page} pageSize={pagination.pageSize} pageCount={pagination.pageCount} totalItems={filteredReceipts.length} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
        </Card>
      </main>

      {selected && form ? (
        <ReceiptDetailDialog
          receipt={selected}
          form={form}
          suppliers={suppliers}
          employees={employees}
          locale={locale}
          text={text}
          saving={saving}
          onChange={setForm}
          onClose={closeReceipt}
          onSubmit={saveReceipt}
        />
      ) : null}
    </DashboardShell>
  );
}

function ReceiptDetailDialog({ receipt, form, suppliers, employees, locale, text, saving, onChange, onClose, onSubmit }: {
  receipt: InventoryReceipt;
  form: ReceiptForm;
  suppliers: Supplier[];
  employees: InventoryRecorderOption[];
  locale: "zh-CN" | "en-GB";
  text: LocalisedText;
  saving: boolean;
  onChange: (value: ReceiptForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const supplierOptions = suppliers.map((supplier) => ({
    supplier,
    term: supplier.supplied_ingredients.find(
      (row) => row.ingredient === receipt.ingredient_id && row.is_active,
    ),
  })).filter((row): row is { supplier: Supplier; term: Supplier["supplied_ingredients"][number] } => Boolean(row.term));
  const selectedSupplier = supplierOptions.find((row) => row.supplier.id === form.supplierId);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving]);

  function openInvoice() {
    if (form.invoice) {
      const url = URL.createObjectURL(form.invoice);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    if (receipt.invoice_file) {
      const url = URL.createObjectURL(receipt.invoice_file);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    if (receipt.invoice_download_url) window.open(receipt.invoice_download_url, "_blank", "noopener,noreferrer");
  }

  const hasExistingInvoice = Boolean(receipt.invoice_name || receipt.invoice_file || receipt.invoice_download_url);
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/35 p-3 sm:p-5" role="presentation">
      <button type="button" className="absolute inset-0" aria-label={text.close} disabled={saving} onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby="receipt-detail-title" className="relative z-10 max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-5 py-4">
          <div className="min-w-0">
            <h2 id="receipt-detail-title" className="text-base font-semibold">{text.detailTitle}</h2>
            <p className="mt-1 truncate text-sm text-[var(--muted)]">{receipt.reference} · {receipt.ingredient_name}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={text.close} disabled={saving} onClick={onClose}><X className="size-5" /></Button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label={text.ingredient}><input readOnly value={receipt.ingredient_name} className={cn(inputClass, "bg-[var(--surface-muted)]")} /></Field>
            <Field label={text.supplier}>
              <select required value={form.supplierId} className={inputClass} disabled={saving} onChange={(event) => {
                const option = supplierOptions.find((row) => row.supplier.id === event.target.value);
                onChange({ ...form, supplierId: event.target.value, unitPrice: option?.term.unit_price ?? "" });
              }}>
                {supplierOptions.map(({ supplier }) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </Field>
            <Field label={text.quantity}>
              <div className="flex"><input required type="number" min="0.001" step="0.001" value={form.quantity} className={cn(inputClass, "rounded-r-none")} disabled={saving} onChange={(event) => onChange({ ...form, quantity: event.target.value })} /><span className="grid h-10 min-w-14 place-items-center rounded-r-lg border border-l-0 border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm">{receipt.unit}</span></div>
            </Field>
            <Field label={text.unitPrice}>
              <div className="flex"><span className="grid h-10 min-w-12 place-items-center rounded-l-lg border border-r-0 border-[var(--border)] bg-[var(--surface-muted)] px-2 text-sm">{selectedSupplier?.term.currency ?? receipt.currency}</span><input required type="number" min="0.0001" step="0.0001" value={form.unitPrice} className={cn(inputClass, "rounded-none")} disabled={saving} onChange={(event) => onChange({ ...form, unitPrice: event.target.value })} /><span className="grid h-10 min-w-14 place-items-center rounded-r-lg border border-l-0 border-[var(--border)] bg-[var(--surface-muted)] px-2 text-sm">/{selectedSupplier?.term.price_unit ?? receipt.price_unit}</span></div>
            </Field>
            <Field label={text.purchasedAt}><DateInput required locale={locale} value={form.receivedAt} className={inputClass} disabled={saving} onChange={(value) => onChange({ ...form, receivedAt: value })} /></Field>
            <Field label={text.recordedBy}>
              <select required value={form.recordedById} className={inputClass} disabled={saving} onChange={(event) => onChange({ ...form, recordedById: event.target.value })}>
                <option value="">{text.recordedBy}</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.position ? ` · ${employee.position}` : ""}</option>)}
              </select>
            </Field>
            <Field label={text.notes} wide><textarea rows={3} maxLength={255} value={form.notes} className={cn(inputClass, "h-auto resize-y py-2")} disabled={saving} onChange={(event) => onChange({ ...form, notes: event.target.value })} /></Field>
            <Field label={text.invoice} wide>
              <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-5 shrink-0 text-[var(--primary)]" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{(form.invoice?.name ?? receipt.invoice_name) || text.noInvoice}</p>{receipt.invoice_size && !form.invoice ? <p className="text-xs text-[var(--muted)]">{formatFileSize(receipt.invoice_size, locale)}</p> : null}</div>
                  {(form.invoice || (hasExistingInvoice && !form.removeInvoice)) ? <Button type="button" variant="ghost" size="icon" title={text.downloadInvoice} aria-label={text.downloadInvoice} onClick={openInvoice}><Download className="size-4" /></Button> : null}
                </div>
                {form.removeInvoice ? <p className="text-xs text-rose-600">{text.invoiceWillBeRemoved}</p> : form.invoice ? <p className="text-xs text-emerald-700">{text.replacementSelected}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-medium hover:bg-[var(--surface-muted)]">
                    <Upload className="size-4" />{text.chooseInvoice}
                    <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" disabled={saving} onChange={(event) => onChange({ ...form, invoice: event.target.files?.[0] ?? null, removeInvoice: false })} />
                  </label>
                  {hasExistingInvoice && !form.invoice && !form.removeInvoice ? <Button type="button" variant="ghost" className="h-9 text-rose-600" onClick={() => onChange({ ...form, removeInvoice: true })}><Trash2 className="size-4" />{text.removeInvoice}</Button> : null}
                  {(form.invoice || form.removeInvoice) ? <Button type="button" variant="ghost" className="h-9" onClick={() => onChange({ ...form, invoice: null, removeInvoice: false })}>{text.cancel}</Button> : null}
                </div>
                <p className="text-xs text-[var(--muted)]">{text.uploadHint}</p>
              </div>
            </Field>
          </div>
          <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--background)] px-5 py-4">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>{text.cancel}</Button>
            <Button type="submit" disabled={saving || !form.supplierId || !form.recordedById || Number(form.quantity) <= 0 || Number(form.unitPrice) <= 0 || !form.receivedAt}><Save className="size-4" />{saving ? text.saving : text.save}</Button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={cn("block space-y-1.5 text-sm font-medium", wide && "sm:col-span-2")}><span>{label}</span>{children}</label>;
}

const inputClass = "h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]";

function dateToLocalIso(value: string) {
  return new Date(`${value}T12:00:00`).toISOString();
}

function formatDateTime(value: string, locale: "zh-CN" | "en-GB") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function formatCurrency(value: number, currency: string, locale: "zh-CN" | "en-GB") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: currency || "GBP" }).format(value);
}

function formatNumber(value: string, locale: "zh-CN" | "en-GB") {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(Number(value));
}

function formatFileSize(value: number, locale: "zh-CN" | "en-GB") {
  return new Intl.NumberFormat(locale, { style: "unit", unit: value >= 1024 * 1024 ? "megabyte" : "kilobyte", maximumFractionDigits: 1 }).format(value >= 1024 * 1024 ? value / 1024 / 1024 : value / 1024);
}
