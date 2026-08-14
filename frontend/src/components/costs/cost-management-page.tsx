"use client";

import { addMonths, format } from "date-fns";
import { enGB, zhCN } from "date-fns/locale";
import {
  CalendarDays,
  ChartPie,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createMonthlyCostItem,
  deleteMonthlyCost,
  getMonthlyCostItems,
  getCostOverview,
  getWageDetails,
  saveMonthlyCostItems,
  updateMonthlyCost,
  type CostCategory,
  type CostOverview,
  type MonthlyCost,
  type MonthlyCostItemInput,
  type WageDetail,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type ItemFormState = MonthlyCostItemInput;

const categories: CostCategory[] = [
  "RENT",
  "UTILITIES",
  "INSURANCE",
  "SOFTWARE",
  "MAINTENANCE",
  "CLEANING",
  "ACCOUNTING",
  "EQUIPMENT_RENTAL",
  "WASTE",
  "OTHER",
];

const chartColours = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#db2777",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#4f46e5",
  "#65a30d",
  "#9333ea",
  "#0f766e",
  "#ea580c",
  "#475569",
];

const copy = {
  "zh-CN": {
    title: "成本管理",
    description: "记录每月实际经营成本，员工工资和食材物料由业务数据自动计算",
    views: { monthly: "每月实际成本", items: "成本项目" },
    previous: "上一个月",
    next: "下一个月",
    addCost: "添加成本",
    addItem: "新增成本项目",
    saveChanges: "保存当月成本",
    total: "本月实际成本",
    wages: "员工工资",
    other: "其他经营成本",
    item: "成本项目",
    category: "分类",
    amount: "金额",
    date: "发生月份",
    source: "数据来源",
    notes: "备注",
    actions: "操作",
    automatic: "自动",
    manual: "手动",
    production: "生产数据",
    scheduleSource: "来自员工排班",
    materialSource: "来自实际制作与生产计划",
    materialUnavailable: "无法计算",
    materialIncomplete: "项生产记录缺少可用的产品成本",
    viewDetails: "查看明细",
    openSchedule: "查看员工排班",
    edit: "编辑",
    delete: "删除",
    enabled: "启用",
    disabled: "停用",
    status: "状态",
    nameZh: "中文名称",
    nameEn: "英文名称",
    save: "保存",
    cancel: "取消",
    loading: "正在读取成本数据...",
    emptyCosts: "这个月还没有手动经营成本",
    emptyWages: "这个月还没有可计薪的历史排班",
    deleteConfirm: "确定删除这条成本记录吗？",
    deleteItemConfirm: "确定从当前月份删除这个成本项目吗？历史月份不会受到影响。",
    deleteItemTitle: "删除成本项目",
    confirmDelete: "确认删除",
    saved: "成本数据已保存",
    deleted: "成本记录已删除",
    itemSaved: "成本项目已保存",
    loadError: "成本数据加载失败",
    formError: "请完整填写成本项目、金额和发生日期",
    itemFormError: "请完整填写中英文名称和分类",
    itemNote: "输入该月各项实际金额后统一保存；员工工资和食材物料为自动计算，不可修改。",
    wageTitle: "员工工资明细",
    employee: "员工",
    deletedEmployee: "已删除员工",
    position: "岗位",
    shifts: "班次数",
    hours: "实际工时",
    hourlyRate: "时薪",
    wage: "工资",
    monthTotal: "当月总成本",
    chartTitle: "当月成本构成",
    chartEmpty: "当前月份暂无大于 0 的成本",
    percentage: "占比",
    categoryNames: {
      RENT: "房租",
      UTILITIES: "水电",
      INSURANCE: "保险",
      SOFTWARE: "软件",
      MAINTENANCE: "维修",
      CLEANING: "清洁",
      ACCOUNTING: "会计",
      EQUIPMENT_RENTAL: "设备租赁",
      WASTE: "垃圾处理",
      MATERIALS: "食材物料",
      OTHER: "其他",
    },
  },
  "en-GB": {
    title: "Cost Management",
    description: "Record monthly operating costs, with wages and materials calculated from operational data",
    views: { monthly: "Monthly Actual Costs", items: "Cost Items" },
    previous: "Previous month",
    next: "Next month",
    addCost: "Add Cost",
    addItem: "New Cost Item",
    saveChanges: "Save Monthly Costs",
    total: "Actual Cost This Month",
    wages: "Employee Wages",
    other: "Other Operating Costs",
    item: "Cost Item",
    category: "Category",
    amount: "Amount",
    date: "Incurred Month",
    source: "Source",
    notes: "Notes",
    actions: "Actions",
    automatic: "Automatic",
    manual: "Manual",
    production: "Production",
    scheduleSource: "From staff schedules",
    materialSource: "From actual production and production plans",
    materialUnavailable: "Cannot calculate",
    materialIncomplete: "production records are missing a usable product cost",
    viewDetails: "View Details",
    openSchedule: "View Staff Schedule",
    edit: "Edit",
    delete: "Delete",
    enabled: "Enabled",
    disabled: "Disabled",
    status: "Status",
    nameZh: "Chinese Name",
    nameEn: "English Name",
    save: "Save",
    cancel: "Cancel",
    loading: "Loading cost data...",
    emptyCosts: "No manual operating costs have been recorded for this month",
    emptyWages: "There are no payable historical shifts for this month",
    deleteConfirm: "Delete this cost record?",
    deleteItemConfirm: "Remove this cost item from the selected month? Historical months will not be affected.",
    deleteItemTitle: "Delete Cost Item",
    confirmDelete: "Delete",
    saved: "Cost data saved",
    deleted: "Cost record deleted",
    itemSaved: "Cost item saved",
    loadError: "Unable to load cost data",
    formError: "Complete the cost item, amount and incurred date",
    itemFormError: "Complete both names and choose a category",
    itemNote: "Enter manual costs and save them together. Employee wages and materials are calculated automatically.",
    wageTitle: "Employee Wage Details",
    employee: "Employee",
    deletedEmployee: "Deleted employee",
    position: "Position",
    shifts: "Shifts",
    hours: "Actual Hours",
    hourlyRate: "Hourly Rate",
    wage: "Wage",
    monthTotal: "Monthly Total Cost",
    chartTitle: "Monthly Cost Breakdown",
    chartEmpty: "No costs above zero for this month",
    percentage: "Share",
    categoryNames: {
      RENT: "Rent",
      UTILITIES: "Utilities",
      INSURANCE: "Insurance",
      SOFTWARE: "Software",
      MAINTENANCE: "Maintenance",
      CLEANING: "Cleaning",
      ACCOUNTING: "Accounting",
      EQUIPMENT_RENTAL: "Equipment Rental",
      WASTE: "Waste Disposal",
      MATERIALS: "Ingredients & Materials",
      OTHER: "Other",
    },
  },
} as const;

export function CostManagementPage() {
  const { locale } = useAppPreferences();
  const { showSuccess } = useToast();
  const text = copy[locale];
  const dateLocale = locale === "en-GB" ? enGB : zhCN;
  const [monthDate, setMonthDate] = useState(() => new Date(2026, 7, 1));
  const month = format(monthDate, "yyyy-MM");
  const [overview, setOverview] = useState<CostOverview | null>(null);
  const [items, setItems] = useState<MonthlyCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MonthlyCost | null | undefined>(undefined);
  const [deletingItem, setDeletingItem] = useState<MonthlyCost | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm);
  const [wages, setWages] = useState<WageDetail | null>(null);
  const [itemAmounts, setItemAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextOverview, nextItems] = await Promise.all([
        getCostOverview(month),
        getMonthlyCostItems(month),
      ]);
      setOverview(nextOverview);
      setItems(nextItems);
      setItemAmounts(
        Object.fromEntries(
          nextItems.map((item) => [item.id, Number(item.amount) ? item.amount : ""]),
        ),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [month, text.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function openItem(item?: MonthlyCost) {
    if (item) {
      setItemForm({
        name_zh: item.name_zh,
        name_en: item.name_en,
        category: item.category,
        amount: item.amount,
        notes: item.notes,
      });
      setEditingItem(item);
    } else {
      setItemForm(emptyItemForm());
      setEditingItem(null);
    }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemForm.name_zh.trim() || !itemForm.name_en.trim()) {
      setError(text.itemFormError);
      return;
    }
    setSaving(true);
    try {
      if (editingItem) await updateMonthlyCost(editingItem.id, itemForm);
      else await createMonthlyCostItem(month, itemForm);
      setEditingItem(undefined);
      showSuccess(text.itemSaved);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.itemFormError);
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item: MonthlyCost) {
    setSaving(true);
    setError(null);
    try {
      await deleteMonthlyCost(item.id);
      setDeletingItem(null);
      showSuccess(text.deleted);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : text.loadError);
    } finally {
      setSaving(false);
    }
  }

  async function openWages() {
    try {
      setWages(await getWageDetails(month));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.loadError);
    }
  }

  async function saveItemAmounts() {
    setSaving(true);
    setError(null);
    try {
      await saveMonthlyCostItems(
        month,
        items.filter((item) => !item.is_read_only).map((item) => ({
          monthly_cost: item.id,
          amount: itemAmounts[item.id]?.trim() || "0.00",
        })),
      );
      showSuccess(text.saved);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.formError);
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
            <p className="mt-1.5 text-sm text-[var(--muted)]">{text.description}</p>
          </div>
          <Button variant="outline" onClick={() => openItem()}>
            <Plus className="size-4" />
            {text.addItem}
          </Button>
        </header>

        <div className="mb-5 flex flex-wrap items-center justify-end gap-2 border-b border-[var(--border)] pb-4">
          <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" aria-label={text.previous} onClick={() => setMonthDate((value) => addMonths(value, -1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <label className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="month"
                  value={month}
                  className={`${inputClass} min-w-44 pl-9`}
                  onChange={(event) => setMonthDate(new Date(`${event.target.value}-01T12:00:00`))}
                />
              </label>
              <Button variant="outline" size="icon" aria-label={text.next} onClick={() => setMonthDate((value) => addMonths(value, 1))}>
                <ChevronRight className="size-4" />
              </Button>
              <Button variant="outline" disabled={saving || loading} onClick={() => void saveItemAmounts()}>
                <WalletCards className="size-4" />
                {text.saveChanges}
              </Button>
            </div>
        </div>

        {error ? (
          <button type="button" className="mb-4 w-full rounded-lg bg-[var(--danger-soft)] px-4 py-3 text-left text-sm text-rose-600" onClick={() => setError(null)}>
            {error}
          </button>
        ) : null}

        <MonthlyView
          overview={overview}
          items={items}
          amounts={itemAmounts}
          loading={loading}
          text={text}
          dateLocale={dateLocale}
          monthDate={monthDate}
          month={month}
          saving={saving}
          onAmountChange={(id, amount) =>
            setItemAmounts((current) => ({ ...current, [id]: amount }))
          }
          onEdit={openItem}
          onDelete={setDeletingItem}
          onWages={() => void openWages()}
        />
        {editingItem !== undefined ? (
          <ItemDialog
            text={text}
            value={itemForm}
            editing={Boolean(editingItem)}
            saving={saving}
            onChange={setItemForm}
            onClose={() => setEditingItem(undefined)}
            onSubmit={saveItem}
          />
        ) : null}
        {deletingItem ? (
          <Modal title={text.deleteItemTitle} onClose={() => setDeletingItem(null)}>
            <p className="text-sm leading-6 text-[var(--muted)]">
              {text.deleteItemConfirm} <span className="font-medium text-[var(--foreground)]">{locale === "zh-CN" ? deletingItem.name_zh : deletingItem.name_en}</span>
            </p>
            <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <Button variant="outline" onClick={() => setDeletingItem(null)}>{text.cancel}</Button>
              <Button className="bg-rose-600 text-white hover:bg-rose-700" disabled={saving} onClick={() => void removeItem(deletingItem)}>
                <Trash2 className="size-4" />
                {text.confirmDelete}
              </Button>
            </div>
          </Modal>
        ) : null}
        {wages ? <WageDrawer text={text} detail={wages} onClose={() => setWages(null)} /> : null}
      </main>
    </DashboardShell>
  );
}

function MonthlyView({ overview, items, amounts, loading, text, dateLocale, monthDate, month, saving, onAmountChange, onEdit, onDelete, onWages }: {
  overview: CostOverview | null;
  items: MonthlyCost[];
  amounts: Record<string, string>;
  loading: boolean;
  text: typeof copy["zh-CN"] | typeof copy["en-GB"];
  dateLocale: typeof enGB;
  monthDate: Date;
  month: string;
  saving: boolean;
  onAmountChange: (id: string, amount: string) => void;
  onEdit: (item: MonthlyCost) => void;
  onDelete: (item: MonthlyCost) => void;
  onWages: () => void;
}) {
  const summary = overview?.summary;
  const chinese = text.title === "成本管理";
  return (
    <>
      <MonthlyCostChart overview={overview} text={text} />
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 className="font-semibold">{format(monthDate, "MMMM yyyy", { locale: dateLocale })}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">{text.item}</th><th className="px-4 py-3">{text.category}</th><th className="px-4 py-3 text-right">{text.amount}</th><th className="px-4 py-3">{text.date}</th><th className="px-4 py-3">{text.source}</th><th className="px-4 py-3">{text.notes}</th><th className="px-4 py-3 text-right">{text.actions}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--border)] bg-[var(--primary-soft)]/30">
                <td className="px-4 py-3 font-medium">{text.wages}</td><td className="px-4 py-3">{localeCategory("OTHER", text, true)}</td><td className="px-4 py-3"><div className="relative ml-auto w-40"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">£</span><input readOnly aria-label={text.wages} className={`${inputClass} cursor-not-allowed bg-[var(--surface-muted)] pl-7 text-right font-medium tabular-nums`} value={overview?.wage_entry.amount ?? "0.00"} /></div></td><td className="px-4 py-3 font-mono text-xs">{month}</td><td className="px-4 py-3"><SourceBadge automatic text={text} /></td><td className="px-4 py-3 text-[var(--muted)]">{text.scheduleSource}</td><td className="px-4 py-3 text-right"><Button variant="ghost" className="h-8 px-2" onClick={onWages}><Eye className="size-4" />{text.viewDetails}</Button></td>
              </tr>
              {items.map((item) => {
                const automaticMaterial = item.source === "PRODUCTION";
                return (
                  <tr key={item.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]">
                    <td className="px-4 py-3"><p className="font-medium">{chinese ? item.name_zh : item.name_en}</p><p className="text-xs text-[var(--muted)]">{chinese ? item.name_en : item.name_zh}</p></td>
                    <td className="px-4 py-3">{text.categoryNames[item.category]}</td>
                    <td className="px-4 py-3">
                      {automaticMaterial && !item.calculation_complete ? <p className="text-right text-sm font-medium text-amber-600">{text.materialUnavailable}</p> : <div className="relative ml-auto w-40"><span className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sm text-[var(--muted)]">£</span><input min="0" step="0.01" type="number" readOnly={item.is_read_only} aria-label={`${chinese ? item.name_zh : item.name_en} ${text.amount}`} className={cn(inputClass, "pl-7 text-right tabular-nums", item.is_read_only && "cursor-not-allowed bg-[var(--surface-muted)] font-medium")} placeholder="0.00" value={amounts[item.id] ?? ""} onChange={(event) => onAmountChange(item.id, event.target.value)} /></div>}
                      {!item.calculation_complete ? <p className="mt-1 text-right text-xs text-amber-600">{item.missing_cost_count} {text.materialIncomplete}</p> : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{month}</td>
                    <td className="px-4 py-3"><SourceBadge source={item.source} text={text} /></td>
                    <td className="max-w-64 px-4 py-3 text-[var(--muted)]">{automaticMaterial ? text.materialSource : item.notes || "—"}</td>
                    <td className="px-4 py-3 text-right">{automaticMaterial ? <span className="text-[var(--muted)]">—</span> : <><Button variant="ghost" size="icon" aria-label={`${text.edit}: ${chinese ? item.name_zh : item.name_en}`} onClick={() => onEdit(item)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" className="text-rose-600" disabled={saving} aria-label={`${text.delete}: ${chinese ? item.name_zh : item.name_en}`} onClick={() => onDelete(item)}><Trash2 className="size-4" /></Button></>}</td>
                  </tr>
                );
              })}
              {loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--muted)]">{text.loading}</td></tr> : null}
            </tbody>
            <tfoot className="border-t-2 border-[var(--border)] bg-[var(--surface-muted)] font-semibold">
              <tr><td colSpan={2} className="px-4 py-4">{text.monthTotal}</td><td className="px-4 py-4 text-right tabular-nums">{money(summary?.total_cost)}</td><td colSpan={4} /></tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}

function MonthlyCostChart({ overview, text }: {
  overview: CostOverview | null;
  text: typeof copy["zh-CN"] | typeof copy["en-GB"];
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const chinese = text.title === "成本管理";
  const data = [
    ...(Number(overview?.wage_entry.amount ?? 0) > 0
      ? [{ key: "employee-wages", name: text.wages, value: Number(overview?.wage_entry.amount ?? 0) }]
      : []),
    ...(overview?.manual_costs ?? [])
      .filter((cost) => Number(cost.amount) > 0)
      .map((cost) => ({
        key: cost.id,
        name: chinese ? cost.cost_item_name_zh : cost.cost_item_name_en,
        value: Number(cost.amount),
      })),
  ].sort((left, right) => right.value - left.value || left.name.localeCompare(right.name));
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const activeKey = data.some((item) => item.key === selectedKey) ? selectedKey : null;
  const select = (key: string) => setSelectedKey((current) => (current === key ? null : key));

  return (
    <Card className="mb-5 overflow-hidden">
      <header className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
        <span className="grid size-9 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          <ChartPie className="size-4.5" />
        </span>
        <div>
          <h2 className="font-semibold">{text.chartTitle}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {text.total}: {money(String(total))}
          </p>
        </div>
      </header>
      {data.length ? (
        <div className="grid items-center gap-4 p-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:p-5">
          <div className="relative mx-auto h-72 w-full max-w-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  startAngle={90}
                  endAngle={-270}
                  innerRadius={76}
                  outerRadius={116}
                  paddingAngle={data.length > 1 ? 2 : 0}
                  stroke="var(--card)"
                  strokeWidth={2}
                  onClick={(_, index) => select(data[index].key)}
                >
                  {data.map((item, index) => (
                    <Cell
                      key={item.key}
                      className="cursor-pointer outline-none transition-opacity duration-200"
                      fill={chartColours[index % chartColours.length]}
                      opacity={activeKey && activeKey !== item.key ? 0.24 : 1}
                      stroke={activeKey === item.key ? "var(--foreground)" : "var(--card)"}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-xs text-[var(--muted)]">{text.total}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{money(String(total))}</p>
              </div>
            </div>
          </div>
          <div className="grid content-start gap-2 sm:grid-cols-2">
            {data.map((item, index) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={activeKey === item.key}
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-md border-b border-[var(--border)] px-2 py-3 text-left transition-colors",
                  activeKey === item.key && "bg-[var(--surface-muted)] ring-1 ring-inset ring-[var(--border)]",
                  activeKey && activeKey !== item.key && "opacity-40",
                )}
                onClick={() => select(item.key)}
              >
                <span
                  className="size-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: chartColours[index % chartColours.length] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {text.percentage} {total ? ((item.value / total) * 100).toFixed(1) : "0.0"}%
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums">{money(String(item.value))}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid min-h-64 place-items-center px-5 py-12 text-center text-sm text-[var(--muted)]">
          {text.chartEmpty}
        </div>
      )}
    </Card>
  );
}

function ItemDialog({ text, value, editing, saving, onChange, onClose, onSubmit }: { text: typeof copy["zh-CN"] | typeof copy["en-GB"]; value: ItemFormState; editing: boolean; saving: boolean; onChange: (value: ItemFormState) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Modal title={editing ? text.edit : text.addItem} onClose={onClose}><form className="space-y-4" onSubmit={onSubmit}><div className="grid gap-4 sm:grid-cols-2"><Field label={text.nameZh}><input required className={inputClass} value={value.name_zh} onChange={(event) => onChange({ ...value, name_zh: event.target.value })} /></Field><Field label={text.nameEn}><input required className={inputClass} value={value.name_en} onChange={(event) => onChange({ ...value, name_en: event.target.value })} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label={text.category}><select className={inputClass} value={value.category} onChange={(event) => onChange({ ...value, category: event.target.value as CostCategory })}>{categories.map((category) => <option key={category} value={category}>{text.categoryNames[category]}</option>)}</select></Field><Field label={text.amount}><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">£</span><input min="0" step="0.01" type="number" className={`${inputClass} pl-7 text-right tabular-nums`} placeholder="0.00" value={value.amount ?? ""} onChange={(event) => onChange({ ...value, amount: event.target.value })} /></div></Field></div><Field label={text.notes}><textarea rows={3} maxLength={500} className={`${inputClass} h-auto py-2`} value={value.notes} onChange={(event) => onChange({ ...value, notes: event.target.value })} /></Field><DialogActions text={text} saving={saving} onClose={onClose} /></form></Modal>;
}

function WageDrawer({ text, detail, onClose }: { text: typeof copy["zh-CN"] | typeof copy["en-GB"]; detail: WageDetail; onClose: () => void }) {
  return <div className="fixed inset-0 z-[80] bg-slate-950/30" role="dialog" aria-modal="true"><button type="button" className="absolute inset-0" aria-label={text.cancel} onClick={onClose} /><aside className="absolute inset-y-0 right-0 z-10 flex w-full max-w-3xl flex-col border-l border-[var(--border)] bg-[var(--card)] shadow-2xl"><header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 className="font-semibold">{text.wageTitle}</h2><p className="mt-1 text-sm text-[var(--muted)]">{detail.month} · {money(detail.total)}</p></div><Button variant="ghost" size="icon" aria-label={text.cancel} onClick={onClose}><X className="size-4" /></Button></header><div className="flex-1 overflow-auto p-5"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="bg-[var(--surface-muted)] text-left text-xs uppercase text-[var(--muted)]"><tr><th className="px-3 py-3">{text.employee}</th><th className="px-3 py-3">{text.position}</th><th className="px-3 py-3 text-right">{text.shifts}</th><th className="px-3 py-3 text-right">{text.hours}</th><th className="px-3 py-3 text-right">{text.hourlyRate}</th><th className="px-3 py-3 text-right">{text.wage}</th></tr></thead><tbody>{detail.employees.map((employee) => <tr key={employee.employee_id} className="border-t border-[var(--border)]"><td className="px-3 py-3"><span className="inline-flex flex-wrap items-center gap-2 font-medium">{employee.employee_name}{employee.is_deleted ? <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600">{text.deletedEmployee}</span> : null}</span></td><td className="px-3 py-3 text-[var(--muted)]">{employee.position}</td><td className="px-3 py-3 text-right tabular-nums">{employee.shift_count}</td><td className="px-3 py-3 text-right tabular-nums">{employee.actual_hours}h</td><td className="px-3 py-3 text-right tabular-nums">{money(employee.hourly_rate)}</td><td className="px-3 py-3 text-right font-medium tabular-nums">{money(employee.wage)}</td></tr>)}</tbody></table></div>{!detail.employees.length ? <p className="py-16 text-center text-sm text-[var(--muted)]">{text.emptyWages}</p> : null}</div><footer className="flex items-center justify-between border-t border-[var(--border)] px-5 py-4"><p className="font-semibold">{text.wages}: {money(detail.total)}</p><Link href="/people/attendance" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium hover:bg-[var(--surface-muted)]"><CalendarDays className="size-4" />{text.openSchedule}</Link></footer></aside></div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/30 p-4" role="dialog" aria-modal="true"><button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} /><div className="relative z-10 w-full max-w-xl rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-2xl"><header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><h2 className="font-semibold">{title}</h2><Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button></header><div className="p-5">{children}</div></div></div>; }
function DialogActions({ text, saving, onClose }: { text: typeof copy["zh-CN"] | typeof copy["en-GB"]; saving: boolean; onClose: () => void }) { return <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4"><Button type="button" variant="outline" onClick={onClose}>{text.cancel}</Button><Button type="submit" variant="outline" disabled={saving}>{text.save}</Button></div>; }
function SourceBadge({ automatic = false, source, text }: { automatic?: boolean; source?: MonthlyCost["source"]; text: typeof copy["zh-CN"] | typeof copy["en-GB"] }) { const isAutomatic = automatic || source === "PRODUCTION"; return <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", isAutomatic ? "bg-sky-500/10 text-sky-600" : "bg-zinc-500/10 text-zinc-600")}>{source === "PRODUCTION" ? text.production : automatic ? text.automatic : text.manual}</span>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium">{label}</span>{children}</label>; }
function emptyItemForm(): ItemFormState { return { name_zh: "", name_en: "", category: "OTHER", amount: "", notes: "" }; }
function money(value?: string) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value ?? 0)); }
function localeCategory(category: CostCategory, text: typeof copy["zh-CN"] | typeof copy["en-GB"], labour = false) { return labour ? (text.title === "成本管理" ? "人力" : "Labour") : text.categoryNames[category]; }
const inputClass = "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)]";
