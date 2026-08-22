"use client";

import {
  addDays,
  format,
  isAfter,
  isEqual,
  parseISO,
  subDays,
  subWeeks,
} from "date-fns";
import { enGB, zhCN } from "date-fns/locale";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import {
  PeriodRangeToolbar,
  periodRange,
  shiftPeriodCursor,
  type PeriodUnit,
} from "@/components/ui/period-range-toolbar";
import {
  createProductionPlans,
  deleteProductionPlan,
  getBusinessDayStatus,
  getProductionPlans,
  updateProductionPlan,
  type ProductionPlan,
  type BusinessDayStatus,
  type ProductionPlanDisplayStatus,
  type ProductionPlanOverview,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type PlanRow = { key: string; productId: string; quantity: string };
type EditForm = { plannedQuantity: string; actualQuantity: string; notes: string };

const copy = {
  "zh-CN": {
    title: "生产计划",
    description: "记录每日产品计划产量与实际产量",
    previous: "上一时间段",
    next: "下一时间段",
    today: "今天",
    thisWeek: "本周",
    future14: "未来14天",
    addPlan: "新增生产计划",
    todayPlanned: "今日计划生产",
    todayActual: "今日实际生产",
    futureSeven: "未来7天计划",
    plannedProducts: "计划产品",
    portions: "份",
    products: "种",
    product: "产品",
    planned: "计划制作",
    actual: "实际制作",
    difference: "差异",
    completion: "完成率",
    status: "状态",
    actions: "操作",
    edit: "编辑",
    loading: "正在读取生产计划...",
    empty: "当前日期范围暂无生产计划",
    loadError: "生产计划加载失败",
    todaySuffix: "今天",
    tomorrowSuffix: "明天",
    yesterdaySuffix: "昨天",
    createTitle: "新增生产计划",
    productionDate: "生产日期",
    copyYesterday: "复制昨日",
    copyLastWeek: "复制上周同一天",
    noSource: "来源日期没有可复制的生产计划",
    copied: (date: string) => `已复制 ${date} 的生产计划`,
    quantity: "计划数量",
    selectProduct: "选择产品",
    addProduct: "添加产品",
    notes: "备注",
    notesPlaceholder: "例如：周末预计客流较高",
    cancel: "取消",
    savePlan: "保存计划",
    saving: "正在保存...",
    saved: "生产计划已保存",
    temporarySaved: "游客临时计划已保存，刷新或登录后不会保留",
    saveError: "生产计划保存失败",
    editTitle: "编辑生产计划",
    delete: "删除计划",
    deleteConfirm: "确定删除这条生产计划吗？",
    deleted: "生产计划已删除",
    temporaryDeleted: "游客临时计划已删除",
    actualHint: "未来日期暂不记录实际产量",
    closureWarning: "该日期已标记为门店不营业",
    overrideClosure: "仍然安排生产（覆盖停业安排）",
    statuses: {
      PLANNED: "已计划",
      IN_PROGRESS: "进行中",
      COMPLETED: "已完成",
      MISSING_ACTUAL: "待补录",
      CANCELLED: "已取消",
    },
  },
  "en-GB": {
    title: "Production Planning",
    description: "Record planned and actual daily production by product",
    previous: "Previous period",
    next: "Next period",
    today: "Today",
    thisWeek: "This week",
    future14: "Next 14 days",
    addPlan: "Add production plan",
    todayPlanned: "Planned today",
    todayActual: "Produced today",
    futureSeven: "Next 7 days",
    plannedProducts: "Planned products",
    portions: "units",
    products: "products",
    product: "Product",
    planned: "Planned",
    actual: "Actual",
    difference: "Variance",
    completion: "Completion",
    status: "Status",
    actions: "Actions",
    edit: "Edit",
    loading: "Loading production plans...",
    empty: "No production plans in this date range",
    loadError: "Unable to load production plans",
    todaySuffix: "Today",
    tomorrowSuffix: "Tomorrow",
    yesterdaySuffix: "Yesterday",
    createTitle: "Add production plan",
    productionDate: "Production date",
    copyYesterday: "Copy yesterday",
    copyLastWeek: "Copy same day last week",
    noSource: "There are no production plans to copy from that date",
    copied: (date: string) => `Copied production plans from ${date}`,
    quantity: "Planned quantity",
    selectProduct: "Select product",
    addProduct: "Add product",
    notes: "Notes",
    notesPlaceholder: "For example: higher weekend footfall expected",
    cancel: "Cancel",
    savePlan: "Save plan",
    saving: "Saving...",
    saved: "Production plan saved",
    temporarySaved: "Guest draft saved temporarily; it will disappear after refresh or login",
    saveError: "Unable to save the production plan",
    editTitle: "Edit production plan",
    delete: "Delete plan",
    deleteConfirm: "Delete this production plan?",
    deleted: "Production plan deleted",
    temporaryDeleted: "Guest draft deleted",
    actualHint: "Actual production is recorded on or after the production date",
    closureWarning: "The store is marked closed on this date",
    overrideClosure: "Schedule production anyway (override closure)",
    statuses: {
      PLANNED: "Planned",
      IN_PROGRESS: "In progress",
      COMPLETED: "Completed",
      MISSING_ACTUAL: "Actual required",
      CANCELLED: "Cancelled",
    },
  },
} as const;

const statusStyles: Record<ProductionPlanDisplayStatus, string> = {
  PLANNED: "bg-blue-50 text-blue-700 ring-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 ring-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  MISSING_ACTUAL: "bg-orange-50 text-orange-700 ring-orange-200",
  CANCELLED: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

const inputClass =
  "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]";

const GUEST_PLAN_ID_PREFIX = "guest-production-plan-";

export function ProductionPlanningPage() {
  const { user } = useAuth();
  const { locale } = useAppPreferences();
  const { showInfo, showSuccess } = useToast();
  const text = copy[locale];
  const dateLocale = locale === "en-GB" ? enGB : zhCN;
  const [today] = useState(() => new Date());
  const [periodUnit, setPeriodUnit] = useState<PeriodUnit>("week");
  const [periodCursor, setPeriodCursor] = useState(() => today);
  const [rangeStart, setRangeStart] = useState(() => dateKey(periodRange("week", today)[0]));
  const [rangeEnd, setRangeEnd] = useState(() => dateKey(periodRange("week", today)[1]));
  const [overview, setOverview] = useState<ProductionPlanOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [productionDate, setProductionDate] = useState(() => dateKey(new Date()));
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [businessDayStatus, setBusinessDayStatus] = useState<BusinessDayStatus | null>(null);
  const [overrideClosure, setOverrideClosure] = useState(false);
  const [editing, setEditing] = useState<ProductionPlan | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ plannedQuantity: "", actualQuantity: "", notes: "" });
  const [guestPlans, setGuestPlans] = useState<ProductionPlan[]>([]);
  const isGuest = !user;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await getProductionPlans(rangeStart, rangeEnd));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [rangeEnd, rangeStart, text.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!createOpen) return;
    const timer = window.setTimeout(async () => {
      try { setBusinessDayStatus(await getBusinessDayStatus(productionDate)); }
      catch { setBusinessDayStatus(null); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [createOpen, productionDate]);

  useEffect(() => {
    if (!user || !guestPlans.length) return;
    const timer = window.setTimeout(() => setGuestPlans([]), 0);
    return () => window.clearTimeout(timer);
  }, [guestPlans.length, user]);

  const visiblePlans = useMemo(
    () => [
      ...(overview?.plans ?? []),
      ...guestPlans.filter((plan) => plan.production_date >= rangeStart && plan.production_date <= rangeEnd),
    ].sort((first, second) => {
      const dateComparison = first.production_date.localeCompare(second.production_date);
      if (dateComparison !== 0) return dateComparison;
      const firstName = locale === "en-GB" ? first.product_name_en : first.product_name_zh;
      const secondName = locale === "en-GB" ? second.product_name_en : second.product_name_zh;
      return firstName.localeCompare(secondName);
    }),
    [guestPlans, locale, overview?.plans, rangeEnd, rangeStart],
  );

  const groupedPlans = useMemo(() => {
    const groups = new Map<string, ProductionPlan[]>();
    for (const plan of visiblePlans) {
      const existing = groups.get(plan.production_date) ?? [];
      existing.push(plan);
      groups.set(plan.production_date, existing);
    }
    return [...groups.entries()];
  }, [visiblePlans]);
  const products = overview?.product_options ?? [];

  function applyPeriod(unit: PeriodUnit, cursor: Date) {
    const [start, end] = periodRange(unit, cursor);
    setPeriodUnit(unit);
    setPeriodCursor(cursor);
    setRangeStart(dateKey(start));
    setRangeEnd(dateKey(end));
  }

  function shiftPeriod(offset: -1 | 1) {
    applyPeriod(periodUnit, shiftPeriodCursor(periodUnit, periodCursor, offset));
  }

  function openCreate(date = new Date()) {
    const firstProduct = products[0];
    setProductionDate(dateKey(date));
    setRows(firstProduct ? [newRow(firstProduct.id)] : []);
    setNotes("");
    setBusinessDayStatus(null);
    setOverrideClosure(false);
    setCreateOpen(true);
  }

  function addRow() {
    const used = new Set(rows.map((row) => row.productId));
    const product = products.find((item) => !used.has(item.id));
    if (product) setRows((current) => [...current, newRow(product.id)]);
  }

  async function copyPlans(sourceDate: Date) {
    const sourceKey = dateKey(sourceDate);
    try {
      const source = await getProductionPlans(sourceKey, sourceKey);
      const sourcePlans = [...source.plans, ...guestPlans.filter((plan) => plan.production_date === sourceKey)];
      if (!sourcePlans.length) {
        showInfo(text.noSource);
        return;
      }
      setRows(
        sourcePlans
          .filter((plan) => plan.display_status !== "CANCELLED")
          .map((plan) => newRow(plan.product_id, String(plan.planned_quantity))),
      );
      setNotes(sourcePlans[0]?.notes ?? "");
      showInfo(text.copied(format(sourceDate, "PP", { locale: dateLocale })));
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : text.loadError);
    }
  }

  async function saveBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rows.length || rows.some((row) => !row.productId || Number(row.quantity) < 1)) return;
    setSaving(true);
    try {
      if (isGuest) {
        setGuestPlans((current) => [
          ...current.filter(
            (plan) => !rows.some((row) => row.productId === plan.product_id && plan.production_date === productionDate),
          ),
          ...rows.map((row) =>
            createGuestProductionPlan({
              productionDate,
              productId: row.productId,
              products,
              plannedQuantity: Number(row.quantity),
              actualQuantity: null,
              notes: notes.trim(),
            }),
          ),
        ]);
        setCreateOpen(false);
        showSuccess(text.temporarySaved);
        return;
      }
      await createProductionPlans({
        production_date: productionDate,
        items: rows.map((row) => ({
          product_id: row.productId,
          planned_quantity: Number(row.quantity),
        })),
        notes: notes.trim(),
        override_business_closure: overrideClosure,
      });
      setCreateOpen(false);
      showSuccess(text.saved);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.saveError);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(plan: ProductionPlan) {
    setEditing(plan);
    setEditForm({
      plannedQuantity: String(plan.planned_quantity),
      actualQuantity: plan.actual_quantity === null ? "" : String(plan.actual_quantity),
      notes: plan.notes,
    });
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || Number(editForm.plannedQuantity) < 1) return;
    setSaving(true);
    try {
      if (isGuestPlan(editing)) {
        setGuestPlans((current) =>
          current.map((plan) =>
            plan.id === editing.id
              ? createGuestProductionPlan({
                  productionDate: editing.production_date,
                  productId: editing.product_id,
                  products,
                  plannedQuantity: Number(editForm.plannedQuantity),
                  actualQuantity: isFutureDate(editing.production_date)
                    ? null
                    : editForm.actualQuantity === ""
                      ? null
                      : Number(editForm.actualQuantity),
                  notes: editForm.notes.trim(),
                  id: editing.id,
                  reference: editing.reference,
                  createdAt: editing.created_at,
                })
              : plan,
          ),
        );
        setEditing(null);
        showSuccess(text.temporarySaved);
        return;
      }
      await updateProductionPlan(editing.id, {
        planned_quantity: Number(editForm.plannedQuantity),
        actual_quantity: isFutureDate(editing.production_date)
          ? undefined
          : editForm.actualQuantity === ""
            ? null
            : Number(editForm.actualQuantity),
        notes: editForm.notes.trim(),
      });
      setEditing(null);
      showSuccess(text.saved);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function removePlan() {
    if (!editing || !window.confirm(text.deleteConfirm)) return;
    setSaving(true);
    try {
      if (isGuestPlan(editing)) {
        setGuestPlans((current) => current.filter((plan) => plan.id !== editing.id));
        setEditing(null);
        showSuccess(text.temporaryDeleted);
        return;
      }
      await deleteProductionPlan(editing.id);
      setEditing(null);
      showSuccess(text.deleted);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : text.saveError);
    } finally {
      setSaving(false);
    }
  }

  const kpis = useMemo(() => buildProductionKpis(visiblePlans, today), [today, visiblePlans]);

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <PageBreadcrumb fallback={{ zh: text.title, en: text.title }} />
            <p className="mt-1.5 text-sm text-[var(--muted)]">{text.description}</p>
          </div>
          <Button onClick={() => openCreate()}>
            <Plus className="size-4" />
            {text.addPlan}
          </Button>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi label={text.todayPlanned} value={kpis?.today_planned ?? 0} suffix={text.portions} icon={ClipboardList} tone="blue" />
          <Kpi label={text.todayActual} value={kpis?.today_actual ?? 0} suffix={text.portions} icon={CheckCircle2} tone="green" />
          <Kpi label={text.futureSeven} value={kpis?.future_7_days_planned ?? 0} suffix={text.portions} icon={CalendarDays} tone="amber" />
          <Kpi label={text.plannedProducts} value={kpis?.planned_product_count ?? 0} suffix={text.products} icon={Clock3} tone="violet" />
        </section>

        <Card className="overflow-hidden rounded-lg">
          {error ? (
            <button type="button" className="w-full border-b border-rose-500/20 bg-[var(--danger-soft)] px-4 py-3 text-left text-sm text-rose-600" onClick={() => setError(null)}>
              {error}
            </button>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-[var(--border)] p-4">
            <PeriodRangeToolbar
              locale={locale}
              unit={periodUnit}
              startDate={rangeStart}
              endDate={rangeEnd}
              loading={loading}
              onUnitChange={(unit) => applyPeriod(unit, today)}
              onShift={shiftPeriod}
              onStartDateChange={setRangeStart}
              onEndDateChange={setRangeEnd}
              onRefresh={() => void load()}
            />
          </div>

          <div className="relative min-h-72">
            {loading ? <div className="absolute inset-0 z-10 grid place-items-center bg-[var(--card)]/85 text-sm text-[var(--muted)]">{text.loading}</div> : null}
            {!loading && !groupedPlans.length ? <div className="grid min-h-72 place-items-center px-4 text-sm text-[var(--muted)]">{text.empty}</div> : null}
            {groupedPlans.map(([date, plans]) => (
              <PlanDateSection
                key={date}
                date={date}
                plans={plans}
                locale={locale}
                text={text}
                dateLocale={dateLocale}
                onEdit={openEdit}
              />
            ))}
          </div>
        </Card>
      </main>

      {createOpen ? (
        <PlanDialog title={text.createTitle} closeLabel={text.cancel} onClose={() => setCreateOpen(false)}>
          <form onSubmit={saveBatch}>
            <div className="space-y-5 p-5">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <Field label={text.productionDate}>
                  <DateInput
                    required
                    locale={locale}
                    value={productionDate}
                    className={inputClass}
                    onChange={(value) => {
                      setProductionDate(value);
                      setBusinessDayStatus(null);
                      setOverrideClosure(false);
                    }}
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void copyPlans(subDays(parseISO(productionDate), 1))}>
                    <Copy className="size-4" />{text.copyYesterday}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void copyPlans(subWeeks(parseISO(productionDate), 1))}>
                    <Copy className="size-4" />{text.copyLastWeek}
                  </Button>
                </div>
              </div>

              {businessDayStatus && !businessDayStatus.is_open ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p className="font-medium">{text.closureWarning}</p>
                  <p className="mt-1">{businessDayStatus.closures.map((closure) => closure.name).join("、")}</p>
                  <label className="mt-3 flex items-center gap-2 font-medium">
                    <input type="checkbox" checked={overrideClosure} onChange={(event) => setOverrideClosure(event.target.checked)} />
                    {text.overrideClosure}
                  </label>
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="hidden grid-cols-[minmax(0,1fr)_10rem_2.5rem] gap-3 text-xs font-medium text-[var(--muted)] sm:grid">
                  <span>{text.product}</span><span>{text.quantity}</span><span />
                </div>
                {rows.map((row, index) => (
                  <div key={row.key} className="grid gap-2 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[minmax(0,1fr)_10rem_2.5rem] sm:border-0 sm:p-0">
                    <select required value={row.productId} className={inputClass} aria-label={text.product} onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, productId: event.target.value } : item))}>
                      <option value="">{text.selectProduct}</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{locale === "en-GB" ? product.name_en : product.name_zh}</option>)}
                    </select>
                    <input required min="1" step="1" type="number" value={row.quantity} className={inputClass} aria-label={text.quantity} onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} />
                    <Button type="button" variant="ghost" size="icon" aria-label={text.delete} disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" disabled={rows.length >= products.length} onClick={addRow}>
                  <Plus className="size-4" />{text.addProduct}
                </Button>
              </div>

              <Field label={text.notes}>
                <textarea value={notes} rows={3} maxLength={255} className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]" placeholder={text.notesPlaceholder} onChange={(event) => setNotes(event.target.value)} />
              </Field>
            </div>
            <DialogFooter cancel={text.cancel} submit={saving ? text.saving : text.savePlan} saving={saving || Boolean(businessDayStatus && !businessDayStatus.is_open && !overrideClosure)} onCancel={() => setCreateOpen(false)} />
          </form>
        </PlanDialog>
      ) : null}

      {editing ? (
        <PlanDialog title={text.editTitle} closeLabel={text.cancel} onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit}>
            <div className="space-y-4 p-5">
              <div className="rounded-lg bg-[var(--surface-muted)] px-4 py-3">
                <p className="font-medium">{locale === "en-GB" ? editing.product_name_en : editing.product_name_zh}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{format(parseISO(editing.production_date), "PPP", { locale: dateLocale })}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={text.planned}>
                  <input required type="number" min="1" step="1" value={editForm.plannedQuantity} className={inputClass} onChange={(event) => setEditForm((current) => ({ ...current, plannedQuantity: event.target.value }))} />
                </Field>
                <Field label={text.actual} hint={isFutureDate(editing.production_date) ? text.actualHint : undefined}>
                  <input type="number" min="0" step="1" disabled={isFutureDate(editing.production_date)} value={editForm.actualQuantity} className={cn(inputClass, "disabled:cursor-not-allowed disabled:opacity-55")} onChange={(event) => setEditForm((current) => ({ ...current, actualQuantity: event.target.value }))} />
                </Field>
              </div>
              <Field label={text.notes}>
                <textarea value={editForm.notes} rows={3} maxLength={255} className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]" onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
              <Button type="button" variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" disabled={saving} onClick={() => void removePlan()}>
                <Trash2 className="size-4" />{text.delete}
              </Button>
            </div>
            <DialogFooter cancel={text.cancel} submit={saving ? text.saving : text.savePlan} saving={saving} onCancel={() => setEditing(null)} />
          </form>
        </PlanDialog>
      ) : null}
    </DashboardShell>
  );
}

function PlanDateSection({ date, plans, locale, text, dateLocale, onEdit }: {
  date: string;
  plans: ProductionPlan[];
  locale: "zh-CN" | "en-GB";
  text: (typeof copy)[keyof typeof copy];
  dateLocale: typeof zhCN;
  onEdit: (plan: ProductionPlan) => void;
}) {
  const parsedDate = parseISO(date);
  const suffix = relativeDateLabel(parsedDate, text);
  return (
    <section className="border-b border-[var(--border)] last:border-b-0">
      <div className="flex items-center gap-2 bg-[var(--surface-muted)] px-4 py-3">
        <h3 className="font-semibold">{format(parsedDate, locale === "en-GB" ? "d MMMM, EEEE" : "M月d日 · EEEE", { locale: dateLocale })}</h3>
        {suffix ? <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-medium text-[var(--primary)]">{suffix}</span> : null}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[850px] table-fixed text-sm">
          <thead className="text-left text-xs text-[var(--muted)]">
            <tr className="border-b border-[var(--border)]">
              <th className="w-[26%] px-4 py-2.5 font-medium">{text.product}</th>
              <th className="w-[12%] px-4 py-2.5 font-medium">{text.planned}</th>
              <th className="w-[12%] px-4 py-2.5 font-medium">{text.actual}</th>
              <th className="w-[11%] px-4 py-2.5 font-medium">{text.difference}</th>
              <th className="w-[13%] px-4 py-2.5 font-medium">{text.completion}</th>
              <th className="w-[16%] px-4 py-2.5 font-medium">{text.status}</th>
              <th className="w-[10%] px-4 py-2.5 text-right font-medium">{text.actions}</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-[var(--border)]/70 last:border-0 hover:bg-[var(--surface-muted)]/50">
                <td className="px-4 py-3 font-medium">{locale === "en-GB" ? plan.product_name_en : plan.product_name_zh}</td>
                <td className="px-4 py-3 tabular-nums">{plan.planned_quantity}</td>
                <td className="px-4 py-3 tabular-nums">{plan.actual_quantity ?? "—"}</td>
                <td className={cn("px-4 py-3 tabular-nums", plan.difference !== null && plan.difference < 0 ? "text-rose-600" : plan.difference !== null && plan.difference > 0 ? "text-emerald-600" : "")}>
                  {formatDifference(plan.difference)}
                </td>
                <td className="px-4 py-3 tabular-nums">{plan.completion_rate === null ? "—" : `${plan.completion_rate}%`}</td>
                <td className="px-4 py-3"><StatusBadge status={plan.display_status} label={text.statuses[plan.display_status]} /></td>
                <td className="px-4 py-3 text-right"><Button type="button" variant="ghost" className="h-8 px-2" onClick={() => onEdit(plan)}><Pencil className="size-3.5" />{text.edit}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-[var(--border)] md:hidden">
        {plans.map((plan) => (
          <button key={plan.id} type="button" className="w-full px-4 py-3 text-left hover:bg-[var(--surface-muted)]" onClick={() => onEdit(plan)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate font-medium">{locale === "en-GB" ? plan.product_name_en : plan.product_name_zh}</p><p className="mt-1 text-xs text-[var(--muted)]">{text.planned} {plan.planned_quantity} · {text.actual} {plan.actual_quantity ?? "—"}</p></div>
              <StatusBadge status={plan.display_status} label={text.statuses[plan.display_status]} />
            </div>
            {plan.actual_quantity !== null ? <div className="mt-2 flex gap-4 text-xs"><span className={plan.difference !== null && plan.difference < 0 ? "text-rose-600" : "text-emerald-600"}>{text.difference} {formatDifference(plan.difference)}</span><span className="text-[var(--muted)]">{text.completion} {plan.completion_rate}%</span></div> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function Kpi({ label, value, suffix, icon: Icon, tone }: { label: string; value: number; suffix: string; icon: typeof ClipboardList; tone: "blue" | "green" | "amber" | "violet" }) {
  const styles = { blue: "bg-[var(--tone-blue-bg)] text-[var(--tone-blue-fg)]", green: "bg-[var(--tone-green-bg)] text-[var(--tone-green-fg)]", amber: "bg-[var(--tone-amber-bg)] text-[var(--tone-amber-fg)]", violet: "bg-[var(--tone-violet-bg)] text-[var(--tone-violet-fg)]" };
  return <Card className="rounded-lg p-4"><div className="flex items-center gap-3"><span className={cn("grid size-10 shrink-0 place-items-center rounded-full", styles[tone])}><Icon className="size-4.5" /></span><div className="min-w-0"><p className="truncate text-xs text-[var(--muted)]">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()} <span className="text-xs font-normal text-[var(--muted)]">{suffix}</span></p></div></div></Card>;
}

function StatusBadge({ status, label }: { status: ProductionPlanDisplayStatus; label: string }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", statusStyles[status])}>{label}</span>;
}

function PlanDialog({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/35 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={title}><button type="button" className="absolute inset-0" aria-label={closeLabel} onClick={onClose} /><section className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-5 py-4"><h2 className="text-lg font-semibold">{title}</h2><Button type="button" variant="ghost" size="icon" className="size-9" aria-label={closeLabel} onClick={onClose}><X className="size-4" /></Button></header>{children}</section></div>;
}

function DialogFooter({ cancel, submit, saving, onCancel }: { cancel: string; submit: string; saving: boolean; onCancel: () => void }) {
  return <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--card)] px-5 py-4"><Button type="button" variant="outline" disabled={saving} onClick={onCancel}>{cancel}</Button><Button type="submit" disabled={saving}><Save className="size-4" />{submit}</Button></footer>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="flex items-center justify-between gap-3 text-sm font-medium"><span>{label}</span>{hint ? <span className="text-xs font-normal text-[var(--muted)]">{hint}</span> : null}</span>{children}</label>;
}

function relativeDateLabel(date: Date, text: (typeof copy)[keyof typeof copy]) {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  if (isEqual(target, today)) return text.todaySuffix;
  if (isEqual(target, addDays(today, 1))) return text.tomorrowSuffix;
  if (isEqual(target, subDays(today, 1))) return text.yesterdaySuffix;
  return "";
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function isFutureDate(value: string) {
  const date = startOfDay(parseISO(value));
  const today = startOfDay(new Date());
  return isAfter(date, today) && !isEqual(date, today);
}

function dateKey(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function newRow(productId: string, quantity = "") : PlanRow {
  return { key: `${Date.now()}-${Math.random()}`, productId, quantity };
}

function formatDifference(value: number | null) {
  if (value === null) return "—";
  return value > 0 ? `+${value}` : String(value);
}

function isGuestPlan(plan: ProductionPlan) {
  return plan.id.startsWith(GUEST_PLAN_ID_PREFIX);
}

function createGuestProductionPlan({
  productionDate,
  productId,
  products,
  plannedQuantity,
  actualQuantity,
  notes,
  id = `${GUEST_PLAN_ID_PREFIX}${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`,
  reference = `GUEST-${Date.now().toString(36).toUpperCase()}`,
  createdAt = new Date().toISOString(),
}: {
  productionDate: string;
  productId: string;
  products: ProductionPlanOverview["product_options"];
  plannedQuantity: number;
  actualQuantity: number | null;
  notes: string;
  id?: string;
  reference?: string;
  createdAt?: string;
}): ProductionPlan {
  const product = products.find((item) => item.id === productId);
  const difference = actualQuantity === null ? null : actualQuantity - plannedQuantity;
  const completionRate =
    actualQuantity === null ? null : Math.round((actualQuantity / plannedQuantity) * 1000) / 10;
  return {
    id,
    reference,
    production_date: productionDate,
    product_id: productId,
    product_name_zh: product?.name_zh ?? "",
    product_name_en: product?.name_en ?? "",
    planned_quantity: plannedQuantity,
    actual_quantity: actualQuantity,
    difference,
    completion_rate: completionRate,
    display_status: actualQuantity === null ? "PLANNED" : "COMPLETED",
    notes,
    created_at: createdAt,
    updated_at: new Date().toISOString(),
  };
}

function buildProductionKpis(plans: ProductionPlan[], today: Date): ProductionPlanOverview["kpis"] {
  const todayKey = dateKey(today);
  const futureSevenEnd = dateKey(addDays(today, 6));
  const activePlans = plans.filter((plan) => plan.display_status !== "CANCELLED");
  const todayPlans = activePlans.filter((plan) => plan.production_date === todayKey);
  return {
    today_planned: todayPlans.reduce((total, plan) => total + plan.planned_quantity, 0),
    today_actual: todayPlans.reduce((total, plan) => total + (plan.actual_quantity ?? 0), 0),
    future_7_days_planned: activePlans
      .filter((plan) => plan.production_date >= todayKey && plan.production_date <= futureSevenEnd)
      .reduce((total, plan) => total + plan.planned_quantity, 0),
    planned_product_count: new Set(activePlans.map((plan) => plan.product_id)).size,
  };
}
