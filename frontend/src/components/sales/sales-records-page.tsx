"use client";

import { Pencil, Search, Trash2, Upload, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataPagination, useDataPagination } from "@/components/ui/data-pagination";
import { DateInput } from "@/components/ui/date-input";
import {
  bulkDeleteSalesData,
  getBakeryProducts,
  getSalesData,
  importSalesData,
  updateSalesData,
  type BakeryProduct,
  type SalesChannel,
  type SalesDataInput,
  type SalesDataRecord,
} from "@/lib/api";

const channels: SalesChannel[] = ["DIRECT", "CONSIGNMENT", "DELIVERY"];
const copy = {
  "zh-CN": {
    title: "销售数据", description: "按日期、销售渠道和产品维护每日汇总数据；同一组合只保留一行", search: "搜索产品",
    start: "开始日期", end: "结束日期", channel: "销售渠道", allChannels: "全部渠道", clear: "清除筛选", import: "导入 CSV",
    importHint: "CSV 列：sales_date、channel、product_code、quantity、received_amount、discount_amount、refund_amount",
    salesDate: "销售日期", product: "产品", quantity: "总销量", received: "总收账", standard: "原价销售额", discount: "折扣金额", refund: "退款金额", net: "净销售额", actions: "操作",
    loading: "正在读取销售数据...", empty: "没有符合条件的销售数据", edit: "编辑", editTitle: "编辑销售数据", cancel: "取消", save: "保存修改", saving: "正在保存...",
    selected: (n: number) => `已选择 ${n} 条销售数据`, selectAll: "全选当前页", select: (name: string) => `选择 ${name}`, delete: "删除所选",
    deleteConfirm: (n: number) => `确认删除选中的 ${n} 条销售数据吗？销售分析将同步变化。`, deleted: (n: number) => `已删除 ${n} 条销售数据`, saved: "销售数据已更新",
    imported: (n: number) => `已导入 ${n} 条销售数据`, loadError: "销售数据加载失败", saveError: "销售数据保存失败", importError: "CSV 导入失败", deleteError: "销售数据删除失败",
    fileError: "请选择 UTF-8 CSV 文件", missingHeaders: "CSV 缺少必要列", invalidRow: (line: number) => `CSV 第 ${line} 行数据无效`, unknownProduct: (code: string) => `找不到产品编号：${code}`,
    duplicate: "同一天、同一渠道、同一产品只能有一行", channelNames: { DIRECT: "现场直销", CONSIGNMENT: "喜家代销", DELIVERY: "外卖平台" },
  },
  "en-GB": {
    title: "Sales Data", description: "Maintain daily totals by date, sales channel and product; each combination is unique", search: "Search product",
    start: "Start date", end: "End date", channel: "Sales channel", allChannels: "All channels", clear: "Clear filters", import: "Import CSV",
    importHint: "CSV columns: sales_date, channel, product_code, quantity, received_amount, discount_amount, refund_amount",
    salesDate: "Sales date", product: "Product", quantity: "Total quantity", received: "Total received", standard: "Standard sales", discount: "Discount", refund: "Refund", net: "Net sales", actions: "Actions",
    loading: "Loading sales data...", empty: "No sales data matches these filters", edit: "Edit", editTitle: "Edit sales data", cancel: "Cancel", save: "Save changes", saving: "Saving...",
    selected: (n: number) => `${n} sales row${n === 1 ? "" : "s"} selected`, selectAll: "Select all on this page", select: (name: string) => `Select ${name}`, delete: "Delete selected",
    deleteConfirm: (n: number) => `Delete ${n} selected sales row${n === 1 ? "" : "s"}? Sales analysis will update accordingly.`, deleted: (n: number) => `${n} sales row${n === 1 ? "" : "s"} deleted`, saved: "Sales data updated",
    imported: (n: number) => `${n} sales row${n === 1 ? "" : "s"} imported`, loadError: "Unable to load sales data", saveError: "Unable to save sales data", importError: "Unable to import CSV", deleteError: "Unable to delete sales data",
    fileError: "Select a UTF-8 CSV file", missingHeaders: "The CSV is missing required columns", invalidRow: (line: number) => `Invalid data on CSV row ${line}`, unknownProduct: (code: string) => `Unknown product code: ${code}`,
    duplicate: "Only one row is allowed for the same date, channel and product", channelNames: { DIRECT: "On-site direct", CONSIGNMENT: "Consignment", DELIVERY: "Delivery platform" },
  },
} as const;

const emptyForm: SalesDataInput = { sales_date: "", channel: "DIRECT", product_id: "", quantity: 1, received_amount: "0.00", discount_amount: "0.00", refund_amount: "0.00" };

export function SalesRecordsPage() {
  const { locale } = useAppPreferences();
  const { showSuccess } = useToast();
  const text = copy[locale];
  const fileInput = useRef<HTMLInputElement>(null);
  const [records, setRecords] = useState<SalesDataRecord[]>([]);
  const [products, setProducts] = useState<BakeryProduct[]>([]);
  const [query, setQuery] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [channel, setChannel] = useState<SalesChannel | "">("");
  const [applied, setApplied] = useState({ search: "", start: "", end: "", channel: "" as SalesChannel | "" });
  const [selected, setSelected] = useState<string[]>([]);
  const [editor, setEditor] = useState<SalesDataRecord | null>(null);
  const [form, setForm] = useState<SalesDataInput>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pagination = useDataPagination(records, 50);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nextRecords, nextProducts] = await Promise.all([getSalesData(applied), getBakeryProducts()]);
      setRecords(nextRecords); setProducts(nextProducts); setSelected([]);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : text.loadError); }
    finally { setLoading(false); }
  }, [applied, text.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const pageIds = pagination.pageItems.map((record) => record.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const totalNetSales = useMemo(() => records.reduce((total, record) => total + Number(record.net_sales_amount), 0), [records]);

  function applyFilters(event: FormEvent) { event.preventDefault(); setApplied({ search: query.trim(), start, end, channel }); pagination.resetPage(); }
  function clearFilters() { setQuery(""); setStart(""); setEnd(""); setChannel(""); setApplied({ search: "", start: "", end: "", channel: "" }); pagination.resetPage(); }
  function openEditor(record: SalesDataRecord) {
    setEditor(record);
    setForm({ sales_date: record.sales_date, channel: record.channel, product_id: record.product_id, product_name_zh: record.product_name_zh, product_name_en: record.product_name_en, quantity: record.quantity, received_amount: record.received_amount, discount_amount: record.discount_amount, refund_amount: record.refund_amount });
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editor) return; setSaving(true); setError(null);
    try {
      const allRecords = await getSalesData();
      if (allRecords.some((record) => record.id !== editor.id && salesKey(record) === salesKey(form))) throw new Error(text.duplicate);
      await updateSalesData(editor.id, form); setEditor(null); showSuccess(text.saved); await load();
    }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : text.saveError); }
    finally { setSaving(false); }
  }
  async function removeSelected() {
    if (!selected.length || !window.confirm(text.deleteConfirm(selected.length))) return;
    setSaving(true); setError(null);
    try { const count = selected.length; await bulkDeleteSalesData(selected); showSuccess(text.deleted(count)); await load(); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : text.deleteError); }
    finally { setSaving(false); }
  }
  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    if (!file.name.toLocaleLowerCase().endsWith(".csv")) { setError(text.fileError); return; }
    setSaving(true); setError(null);
    try {
      const inputs = parseSalesCsv(await file.text(), products, text);
      const existing = new Set((await getSalesData()).map((record) => salesKey(record)));
      if (inputs.some((input) => existing.has(salesKey(input)))) throw new Error(text.duplicate);
      const result = await importSalesData(inputs); showSuccess(text.imported(result.created_count)); await load();
    } catch (importError) { setError(importError instanceof Error ? importError.message : text.importError); }
    finally { setSaving(false); }
  }

  return <DashboardShell><main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
    <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><PageBreadcrumb fallback={{ zh: text.title, en: text.title }} /><div className="flex items-center gap-2"><input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} /><Button type="button" onClick={() => fileInput.current?.click()} disabled={saving}><Upload className="size-4" />{text.import}</Button></div></header>
    <Card className="mb-5 p-4"><form className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_190px_190px_180px_auto]" onSubmit={applyFilters}><label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" /><input className={`${inputClass} pl-9`} placeholder={text.search} value={query} onChange={(event) => setQuery(event.target.value)} /></label><DateInput aria-label={text.start} title={text.start} locale={locale} className={inputClass} value={start} onChange={setStart} /><DateInput aria-label={text.end} title={text.end} locale={locale} className={inputClass} value={end} onChange={setEnd} /><select aria-label={text.channel} className={inputClass} value={channel} onChange={(event) => setChannel(event.target.value as SalesChannel | "")}><option value="">{text.allChannels}</option>{channels.map((value) => <option key={value} value={value}>{text.channelNames[value]}</option>)}</select><div className="flex gap-2"><Button type="submit">{text.search}</Button><Button type="button" variant="ghost" onClick={clearFilters}>{text.clear}</Button></div></form></Card>
    {error ? <div className="mb-5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
    <div className="mb-3 flex min-h-9 items-center justify-between gap-3"><span className="text-sm text-[var(--muted)]">{selected.length ? text.selected(selected.length) : `${records.length} · ${money(totalNetSales, locale)}`}</span>{selected.length ? <Button type="button" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50" onClick={removeSelected} disabled={saving}><Trash2 className="size-4" />{text.delete}</Button> : null}</div>
    <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="bg-[var(--surface-muted)] text-xs text-[var(--muted)]"><tr><th className="w-12 px-4 py-3"><input type="checkbox" aria-label={text.selectAll} checked={allPageSelected} onChange={() => setSelected((current) => allPageSelected ? current.filter((id) => !pageIds.includes(id)) : [...new Set([...current, ...pageIds])])} /></th><th className="px-4 py-3">{text.salesDate}</th><th className="px-4 py-3">{text.channel}</th><th className="px-4 py-3">{text.product}</th><th className="px-4 py-3 text-right">{text.quantity}</th><th className="px-4 py-3 text-right">{text.standard}</th><th className="px-4 py-3 text-right">{text.discount}</th><th className="px-4 py-3 text-right">{text.received}</th><th className="px-4 py-3 text-right">{text.refund}</th><th className="px-4 py-3 text-right">{text.net}</th><th className="px-4 py-3 text-right">{text.actions}</th></tr></thead><tbody>{loading ? <tr><td colSpan={11} className="px-4 py-14 text-center text-[var(--muted)]">{text.loading}</td></tr> : pagination.pageItems.length ? pagination.pageItems.map((record) => <tr key={record.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]"><td className="px-4 py-3"><input type="checkbox" aria-label={text.select(locale === "zh-CN" ? record.product_name_zh : record.product_name_en)} checked={selected.includes(record.id)} onChange={() => setSelected((current) => current.includes(record.id) ? current.filter((id) => id !== record.id) : [...current, record.id])} /></td><td className="whitespace-nowrap px-4 py-3">{dateValue(record.sales_date, locale)}</td><td className="px-4 py-3">{text.channelNames[record.channel]}</td><td className="px-4 py-3 font-medium">{locale === "zh-CN" ? record.product_name_zh : record.product_name_en}</td><td className="px-4 py-3 text-right tabular-nums">{record.quantity}</td><MoneyCell value={record.standard_sales_amount} locale={locale} /><MoneyCell value={record.discount_amount} locale={locale} /><MoneyCell value={record.received_amount} locale={locale} /><MoneyCell value={record.refund_amount} locale={locale} /><MoneyCell value={record.net_sales_amount} locale={locale} strong /><td className="px-4 py-3 text-right"><Button type="button" variant="ghost" size="icon" title={text.edit} onClick={() => openEditor(record)}><Pencil className="size-4" /></Button></td></tr>) : <tr><td colSpan={11} className="px-4 py-14 text-center text-[var(--muted)]">{text.empty}</td></tr>}</tbody></table></div><DataPagination locale={locale} page={pagination.page} pageSize={pagination.pageSize} pageCount={pagination.pageCount} totalItems={records.length} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /></Card>
  </main>{editor ? <EditModal text={text} locale={locale} form={form} products={products} saving={saving} onChange={setForm} onClose={() => setEditor(null)} onSubmit={save} /> : null}</DashboardShell>;
}

function MoneyCell({ value, locale, strong = false }: { value: string; locale: "zh-CN" | "en-GB"; strong?: boolean }) { return <td className={`px-4 py-3 text-right tabular-nums ${strong ? "font-semibold" : ""}`}>{money(Number(value), locale)}</td>; }
function EditModal({ text, locale, form, products, saving, onChange, onClose, onSubmit }: { text: (typeof copy)[keyof typeof copy]; locale: "zh-CN" | "en-GB"; form: SalesDataInput; products: BakeryProduct[]; saving: boolean; onChange: (value: SalesDataInput) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/35 p-4"><div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"><header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><h2 className="font-semibold">{text.editTitle}</h2><Button type="button" variant="ghost" size="icon" onClick={onClose}><X className="size-5" /></Button></header><form onSubmit={onSubmit}><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label={text.salesDate}><DateInput required locale={locale} className={inputClass} value={form.sales_date} onChange={(value) => onChange({ ...form, sales_date: value })} /></Field><Field label={text.channel}><select className={inputClass} value={form.channel} onChange={(event) => onChange({ ...form, channel: event.target.value as SalesChannel })}>{channels.map((value) => <option key={value} value={value}>{text.channelNames[value]}</option>)}</select></Field><Field label={text.product}><select className={inputClass} value={form.product_id} onChange={(event) => { const product = products.find((item) => item.id === event.target.value); onChange({ ...form, product_id: event.target.value, product_name_zh: product?.name_zh, product_name_en: product?.name_en }); }}>{products.map((product) => <option key={product.id} value={product.id}>{locale === "zh-CN" ? product.name_zh : product.name_en}</option>)}</select></Field><Field label={text.quantity}><input required type="number" min="1" step="1" className={inputClass} value={form.quantity} onChange={(event) => onChange({ ...form, quantity: Number(event.target.value) })} /></Field><MoneyInput label={text.received} value={form.received_amount} onChange={(value) => onChange({ ...form, received_amount: value })} /><MoneyInput label={text.discount} value={form.discount_amount} onChange={(value) => onChange({ ...form, discount_amount: value })} /><MoneyInput label={text.refund} value={form.refund_amount} onChange={(value) => onChange({ ...form, refund_amount: value })} /></div><footer className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4"><Button type="button" variant="ghost" onClick={onClose}>{text.cancel}</Button><Button type="submit" disabled={saving}>{saving ? text.saving : text.save}</Button></footer></form></div></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1.5 text-sm"><span className="font-medium">{label}</span>{children}</label>; }
function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <Field label={label}><input required type="number" min="0" step="0.01" className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} /></Field>; }

function parseSalesCsv(source: string, products: BakeryProduct[], text: (typeof copy)[keyof typeof copy]): SalesDataInput[] {
  const rows = parseCsv(source).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length < 2) throw new Error(text.missingHeaders);
  const headers = rows[0].map((header) => header.trim().toLocaleLowerCase());
  const required = ["sales_date", "channel", "product_code", "quantity", "received_amount", "discount_amount", "refund_amount"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`${text.missingHeaders}: ${missing.join(", ")}`);
  const value = (row: string[], key: string) => row[headers.indexOf(key)]?.trim() ?? "";
  const aliases: Record<string, SalesChannel> = { DIRECT: "DIRECT", "现场直销": "DIRECT", "ON-SITE DIRECT": "DIRECT", CONSIGNMENT: "CONSIGNMENT", "喜家代销": "CONSIGNMENT", "代销": "CONSIGNMENT", DELIVERY: "DELIVERY", "外卖平台": "DELIVERY", "DELIVERY PLATFORM": "DELIVERY" };
  const result = rows.slice(1).map((row, index) => {
    const line = index + 2;
    const code = value(row, "product_code");
    const product = products.find((item) => item.code.toLocaleLowerCase() === code.toLocaleLowerCase());
    if (!product) throw new Error(`${text.unknownProduct(code)} (${line})`);
    const channel = aliases[value(row, "channel").toLocaleUpperCase()];
    const salesDate = normaliseSalesDate(value(row, "sales_date"));
    const quantity = Number(value(row, "quantity"));
    const received = Number(value(row, "received_amount"));
    const discount = Number(value(row, "discount_amount"));
    const refund = Number(value(row, "refund_amount"));
    if (!salesDate || !channel || !Number.isInteger(quantity) || quantity < 1 || [received, discount, refund].some((amount) => !Number.isFinite(amount) || amount < 0) || refund > received) throw new Error(text.invalidRow(line));
    return { sales_date: salesDate, channel, product_id: product.id, product_name_zh: product.name_zh, product_name_en: product.name_en, quantity, received_amount: received.toFixed(2), discount_amount: discount.toFixed(2), refund_amount: refund.toFixed(2) };
  });
  if (new Set(result.map(salesKey)).size !== result.length) throw new Error(text.duplicate);
  return result;
}
function salesKey(record: Pick<SalesDataInput, "sales_date" | "channel" | "product_id">) { return `${record.sales_date}|${record.channel}|${record.product_id}`; }
function normaliseSalesDate(value: string): string | null {
  const trimmed = value.trim();
  let year: number;
  let month: number;
  let day: number;
  const yearFirst = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const dayFirst = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (yearFirst) {
    year = Number(yearFirst[1]); month = Number(yearFirst[2]); day = Number(yearFirst[3]);
  } else if (dayFirst) {
    day = Number(dayFirst[1]); month = Number(dayFirst[2]); year = Number(dayFirst[3]);
  } else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function parseCsv(source: string) { const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false; for (let index = 0; index < source.length; index += 1) { const char = source[index]; if (char === '"') { if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; } else if (char === "," && !quoted) { row.push(cell); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && source[index + 1] === "\n") index += 1; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += char; } if (cell || row.length) { row.push(cell); rows.push(row); } return rows; }
function dateValue(value: string, locale: "zh-CN" | "en-GB") { return new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(`${value}T12:00:00`)); }
function money(value: number, locale: "zh-CN" | "en-GB") { return new Intl.NumberFormat(locale, { style: "currency", currency: "GBP" }).format(value); }
const inputClass = "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)]";
