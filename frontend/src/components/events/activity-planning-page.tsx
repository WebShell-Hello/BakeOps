"use client";

import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enGB, zhCN } from "date-fns/locale";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Clock3,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import {
  createActivityPlan,
  deleteActivityPlan,
  getActivityPlanningOverview,
  updateActivityOccurrence,
  updateActivityPlan,
  type ActivityFrequency,
  type ActivityPlan,
  type ActivityPlanInput,
  type ActivityPlanningOverview,
  type ActivityReminderOccurrence,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type ViewMode = "today" | "upcoming" | "calendar" | "plans";

const copy = {
  "zh-CN": {
    title: "活动策划",
    description: "管理推广活动、执行频率和提醒事项",
    add: "新增活动计划",
    loading: "正在读取活动计划...",
    loadError: "活动策划数据加载失败",
    tabs: { today: "今日", upcoming: "即将到来", calendar: "日历", plans: "计划" },
    metrics: { today: "今日待办", overdue: "已逾期", upcoming: "区间待办", active: "执行中计划" },
    emptyToday: "今天没有待处理的活动提醒",
    emptyUpcoming: "未来 30 天没有活动提醒",
    emptyPlans: "尚未创建活动计划",
    complete: "标记完成",
    skip: "跳过本次",
    snooze: "顺延一天",
    edit: "编辑",
    delete: "删除",
    owner: "负责人",
    unassigned: "未分配",
    time: "提醒时间",
    repeat: "重复规则",
    next: "下次提醒",
    status: "状态",
    actions: "操作",
    formCreate: "新增活动计划",
    formEdit: "编辑活动计划",
    name: "活动名称",
    category: "活动分类",
    platform: "活动平台",
    descriptionLabel: "活动描述",
    descriptionPlaceholder: "填写活动目标、执行内容或注意事项",
    priority: "优先级",
    startDate: "开始日期",
    endDate: "结束日期（可选）",
    frequency: "提醒频率",
    interval: "每隔",
    intervalUnit: { ONCE: "次", DAILY: "天", WEEKLY: "周", MONTHLY: "月" },
    frequencies: { ONCE: "仅一次", DAILY: "每天", WEEKLY: "每周", MONTHLY: "每月" },
    weekdays: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    monthDays: "每月日期（可多选）",
    save: "保存",
    saving: "正在保存...",
    cancel: "取消",
    saved: "活动计划已保存",
    deleted: "活动计划已删除",
    updated: "提醒状态已更新",
    confirmDelete: "确定删除这个活动计划吗？相关提醒也会一并删除。",
    priorities: { LOW: "低", NORMAL: "普通", HIGH: "高", URGENT: "紧急" },
    statuses: { DRAFT: "草稿", ACTIVE: "执行中", PAUSED: "已暂停", ENDED: "已结束" },
    occurrenceStatuses: { PENDING: "待处理", OVERDUE: "已逾期", COMPLETED: "已完成", SKIPPED: "已跳过", CANCELLED: "已取消" },
    previousMonth: "上个月",
    nextMonth: "下个月",
  },
  "en-GB": {
    title: "Activity Planning",
    description: "Manage campaigns, schedules and execution reminders",
    add: "Add activity plan",
    loading: "Loading activity plans...",
    loadError: "Unable to load activity planning data",
    tabs: { today: "Today", upcoming: "Upcoming", calendar: "Calendar", plans: "Plans" },
    metrics: { today: "Due today", overdue: "Overdue", upcoming: "Due in range", active: "Active plans" },
    emptyToday: "No activity reminders are due today",
    emptyUpcoming: "No activity reminders in the next 30 days",
    emptyPlans: "No activity plans have been created",
    complete: "Complete",
    skip: "Skip this time",
    snooze: "Snooze one day",
    edit: "Edit",
    delete: "Delete",
    owner: "Owner",
    unassigned: "Unassigned",
    time: "Reminder",
    repeat: "Repeat",
    next: "Next reminder",
    status: "Status",
    actions: "Actions",
    formCreate: "Add activity plan",
    formEdit: "Edit activity plan",
    name: "Activity name",
    category: "Category",
    platform: "Platform",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Add the goal, execution details or notes",
    priority: "Priority",
    startDate: "Start date",
    endDate: "End date (optional)",
    frequency: "Reminder frequency",
    interval: "Every",
    intervalUnit: { ONCE: "time", DAILY: "day(s)", WEEKLY: "week(s)", MONTHLY: "month(s)" },
    frequencies: { ONCE: "Once", DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly" },
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    monthDays: "Days of month (multiple allowed)",
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    saved: "Activity plan saved",
    deleted: "Activity plan deleted",
    updated: "Reminder updated",
    confirmDelete: "Delete this activity plan and all of its reminders?",
    priorities: { LOW: "Low", NORMAL: "Normal", HIGH: "High", URGENT: "Urgent" },
    statuses: { DRAFT: "Draft", ACTIVE: "Active", PAUSED: "Paused", ENDED: "Ended" },
    occurrenceStatuses: { PENDING: "Pending", OVERDUE: "Overdue", COMPLETED: "Completed", SKIPPED: "Skipped", CANCELLED: "Cancelled" },
    previousMonth: "Previous month",
    nextMonth: "Next month",
  },
} as const;

function dateKey(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function emptyForm(today: string): ActivityPlanInput {
  return {
    name: "",
    category_id: "",
    platform_id: "",
    description: "",
    priority: "NORMAL",
    status: "ACTIVE",
    start_date: today,
    end_date: null,
    owner_id: null,
    focus_product_ids: [],
    reminder_rule: {
      frequency: "WEEKLY",
      interval: 1,
      weekdays: [1],
      month_days: [],
      reminder_time: "10:00",
      timezone: "Europe/London",
      is_enabled: true,
    },
  };
}

export function ActivityPlanningPage() {
  const { locale } = useAppPreferences();
  const text = copy[locale];
  const { showSuccess } = useToast();
  const today = useMemo(() => dateKey(new Date()), []);
  const [view, setView] = useState<ViewMode>("today");
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [overview, setOverview] = useState<ActivityPlanningOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityPlan | null>(null);
  const [form, setForm] = useState<ActivityPlanInput>(() => emptyForm(today));
  const [saving, setSaving] = useState(false);

  const range = useMemo(() => ({
    start: dateKey(startOfWeek(startOfMonth(month), { weekStartsOn: 1 })),
    end: dateKey(endOfWeek(addMonths(endOfMonth(month), 1), { weekStartsOn: 1 })),
  }), [month]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await getActivityPlanningOverview(range.start, range.end));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [range.end, range.start, text.loadError]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  function openCreate() {
    const next = emptyForm(today);
    next.category_id = overview?.categories[0]?.id ?? "";
    next.platform_id = overview?.platforms.find((item) => item.category_id === next.category_id)?.id ?? "";
    setEditing(null);
    setForm(next);
    setFormOpen(true);
  }

  function openEdit(plan: ActivityPlan) {
    setEditing(plan);
    setForm({
      name: plan.name,
      category_id: plan.category_id,
      platform_id: plan.platform_id,
      description: plan.description,
      priority: plan.priority,
      status: plan.status,
      start_date: plan.start_date,
      end_date: plan.end_date,
      owner_id: plan.owner_id,
      focus_product_ids: plan.focus_product_ids,
      reminder_rule: {
        frequency: plan.reminder_rule.frequency,
        interval: plan.reminder_rule.interval,
        weekdays: [...plan.reminder_rule.weekdays],
        month_days: [...plan.reminder_rule.month_days],
        reminder_time: plan.reminder_rule.reminder_time.slice(0, 5),
        timezone: plan.reminder_rule.timezone,
        is_enabled: plan.reminder_rule.is_enabled,
      },
    });
    setFormOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) await updateActivityPlan(editing.id, form);
      else await createActivityPlan(form);
      setFormOpen(false);
      showSuccess(text.saved);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.loadError);
    } finally {
      setSaving(false);
    }
  }

  async function remove(plan: ActivityPlan) {
    if (!window.confirm(text.confirmDelete)) return;
    await deleteActivityPlan(plan.id);
    showSuccess(text.deleted);
    await load();
  }

  async function setOccurrence(occurrence: ActivityReminderOccurrence, action: "complete" | "skip" | "snooze") {
    const input = action === "complete"
      ? { status: "COMPLETED" as const }
      : action === "skip"
        ? { status: "SKIPPED" as const }
        : { status: "PENDING" as const, snoozed_until: addDays(parseISO(occurrence.effective_at), 1).toISOString() };
    await updateActivityOccurrence(occurrence.id, input);
    showSuccess(text.updated);
    await load();
  }

  const todayItems = (overview?.occurrences ?? []).filter((item) => item.effective_at.slice(0, 10) === today && ["PENDING", "OVERDUE"].includes(item.display_status));
  const upcomingItems = (overview?.occurrences ?? []).filter((item) => item.effective_at.slice(0, 10) >= today && ["PENDING", "OVERDUE"].includes(item.display_status));

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div><PageBreadcrumb fallback={{ zh: text.title, en: text.title }} /><p className="mt-1.5 text-sm text-[var(--muted)]">{text.description}</p></div>
          <Button onClick={openCreate}><Plus className="size-4" />{text.add}</Button>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric icon={Clock3} label={text.metrics.today} value={overview?.kpis.today_pending ?? 0} tone="blue" />
          <Metric icon={AlertTriangle} label={text.metrics.overdue} value={overview?.kpis.overdue ?? 0} tone="rose" />
          <Metric icon={ListChecks} label={text.metrics.upcoming} value={overview?.kpis.range_pending ?? 0} tone="amber" />
          <Metric icon={CircleCheckBig} label={text.metrics.active} value={overview?.kpis.active_plans ?? 0} tone="green" />
        </section>

        {error ? <button className="mb-4 w-full rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-left text-sm text-rose-700" onClick={() => setError(null)}>{error}</button> : null}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-full overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-1 sm:w-auto">
            {(["today", "upcoming", "calendar", "plans"] as ViewMode[]).map((item) => <button key={item} type="button" className={cn("min-w-0 flex-1 rounded-md px-2 py-2 text-sm transition-colors", view === item ? "bg-[var(--card)] font-medium text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]")} onClick={() => setView(item)}>{text.tabs[item]}</button>)}
          </div>
          {view === "calendar" ? <div className="flex items-center justify-center gap-2"><Button variant="outline" size="icon" aria-label={text.previousMonth} onClick={() => setMonth((value) => addMonths(value, -1))}><ChevronLeft className="size-4" /></Button><strong className="min-w-36 text-center">{format(month, "MMMM yyyy", { locale: locale === "zh-CN" ? zhCN : enGB })}</strong><Button variant="outline" size="icon" aria-label={text.nextMonth} onClick={() => setMonth((value) => addMonths(value, 1))}><ChevronRight className="size-4" /></Button></div> : null}
        </div>

        {loading ? <Card className="grid min-h-80 place-items-center rounded-lg text-sm text-[var(--muted)]">{text.loading}</Card> : view === "calendar" ? (
          <ActivityCalendar month={month} occurrences={overview?.occurrences ?? []} locale={locale} />
        ) : view === "plans" ? (
          <PlansTable plans={overview?.plans ?? []} locale={locale} text={text} onEdit={openEdit} onDelete={(plan) => void remove(plan)} />
        ) : (
          <OccurrenceList items={view === "today" ? todayItems : upcomingItems} locale={locale} text={text} empty={view === "today" ? text.emptyToday : text.emptyUpcoming} onAction={(item, action) => void setOccurrence(item, action)} />
        )}
      </main>

      {formOpen && overview ? <PlanDialog overview={overview} form={form} editing={Boolean(editing)} locale={locale} text={text} saving={saving} onChange={setForm} onClose={() => setFormOpen(false)} onSubmit={save} /> : null}
    </DashboardShell>
  );
}

type Text = (typeof copy)[keyof typeof copy];

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: number; tone: "blue" | "rose" | "amber" | "green" }) {
  const toneClass = { blue: "bg-[var(--tone-blue-bg)] text-[var(--tone-blue-fg)]", rose: "bg-[var(--tone-rose-bg)] text-[var(--tone-rose-fg)]", amber: "bg-[var(--tone-amber-bg)] text-[var(--tone-amber-fg)]", green: "bg-[var(--tone-green-bg)] text-[var(--tone-green-fg)]" }[tone];
  return <Card className="rounded-lg p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></div><span className={cn("grid size-10 place-items-center rounded-lg", toneClass)}><Icon className="size-5" /></span></div></Card>;
}

function OccurrenceList({ items, locale, text, empty, onAction }: { items: ActivityReminderOccurrence[]; locale: "zh-CN" | "en-GB"; text: Text; empty: string; onAction: (item: ActivityReminderOccurrence, action: "complete" | "skip" | "snooze") => void }) {
  if (!items.length) return <Card className="grid min-h-72 place-items-center rounded-lg text-sm text-[var(--muted)]">{empty}</Card>;
  return <Card className="divide-y divide-[var(--border)] overflow-hidden rounded-lg">{items.map((item) => <div key={item.id} className="relative flex flex-col gap-3 py-4 pr-4 pl-7 lg:flex-row lg:items-center"><span className="absolute inset-y-4 left-4 w-1 rounded-full" style={{ background: categoryColour(item.category.colour) }} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm">{item.plan_name}</strong><StatusBadge label={text.occurrenceStatuses[item.display_status]} status={item.display_status} /></div><p className="mt-1 text-xs text-[var(--muted)]">{localeName(item.platform, locale)} · {formatDateTime(item.effective_at, locale)} · {item.owner_name || text.unassigned}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="h-9 px-3" onClick={() => onAction(item, "snooze")}><RotateCcw className="size-3.5" />{text.snooze}</Button><Button variant="outline" className="h-9 px-3" onClick={() => onAction(item, "skip")}><SkipForward className="size-3.5" />{text.skip}</Button><Button className="h-9 px-3" onClick={() => onAction(item, "complete")}><Check className="size-3.5" />{text.complete}</Button></div></div>)}</Card>;
}

function ActivityCalendar({ month, occurrences, locale }: { month: Date; occurrences: ActivityReminderOccurrence[]; locale: "zh-CN" | "en-GB" }) {
  const weekdays = locale === "zh-CN" ? ["一", "二", "三", "四", "五", "六", "日"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  return <Card className="overflow-hidden rounded-lg"><div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-muted)] text-center text-xs text-[var(--muted)]">{weekdays.map((day) => <span key={day} className="py-2.5">{day}</span>)}</div><div className="grid grid-cols-7">{days.map((day) => { const key = dateKey(day); const items = occurrences.filter((item) => item.effective_at.slice(0, 10) === key); return <div key={key} className={cn("min-h-24 border-r border-b border-[var(--border)] p-2 sm:min-h-32", !isSameMonth(day, month) && "bg-[var(--surface-muted)]/40 text-[var(--muted)]", isToday(day) && "bg-[var(--primary-soft)]/60 ring-2 ring-inset ring-[var(--primary)]")}><span className={cn("inline-grid size-7 place-items-center rounded-full text-xs", isToday(day) && "bg-[var(--primary)] font-semibold text-white")}>{format(day, "d")}</span><div className="mt-2 space-y-1">{items.slice(0, 3).map((item) => <div key={item.id} title={item.plan_name} className="truncate rounded px-1.5 py-1 text-[10px] font-medium" style={{ background: `${categoryColour(item.category.colour)}22`, color: categoryColour(item.category.colour) }}>{item.plan_name}</div>)}</div></div>; })}</div></Card>;
}

function PlansTable({ plans, locale, text, onEdit, onDelete }: { plans: ActivityPlan[]; locale: "zh-CN" | "en-GB"; text: Text; onEdit: (plan: ActivityPlan) => void; onDelete: (plan: ActivityPlan) => void }) {
  if (!plans.length) return <Card className="grid min-h-72 place-items-center rounded-lg text-sm text-[var(--muted)]">{text.emptyPlans}</Card>;
  return <Card className="overflow-hidden rounded-lg"><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[var(--surface-muted)] text-xs text-[var(--muted)]"><tr><th className="px-4 py-3">{text.name}</th><th className="px-4 py-3">{text.category}</th><th className="px-4 py-3">{text.platform}</th><th className="px-4 py-3">{text.repeat}</th><th className="px-4 py-3">{text.owner}</th><th className="px-4 py-3">{text.status}</th><th className="px-4 py-3 text-right">{text.actions}</th></tr></thead><tbody>{plans.map((plan) => <tr key={plan.id} className="border-t border-[var(--border)]"><td className="px-4 py-3 font-medium">{plan.name}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: categoryColour(plan.category?.colour) }} />{localeName(plan.category, locale)}</span></td><td className="px-4 py-3">{localeName(plan.platform, locale)}</td><td className="px-4 py-3">{repeatLabel(plan, text)}</td><td className="px-4 py-3">{plan.owner_name || text.unassigned}</td><td className="px-4 py-3"><StatusBadge label={text.statuses[plan.status]} status={plan.status} /></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="size-8" aria-label={text.edit} onClick={() => onEdit(plan)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" className="size-8 text-rose-600" aria-label={text.delete} onClick={() => onDelete(plan)}><Trash2 className="size-4" /></Button></div></td></tr>)}</tbody></table></div></Card>;
}

function PlanDialog({ overview, form, editing, locale, text, saving, onChange, onClose, onSubmit }: { overview: ActivityPlanningOverview; form: ActivityPlanInput; editing: boolean; locale: "zh-CN" | "en-GB"; text: Text; saving: boolean; onChange: (value: ActivityPlanInput) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  const platforms = overview.platforms.filter((item) => item.category_id === form.category_id);
  const inputClass = "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]";
  function setRule(value: Partial<ActivityPlanInput["reminder_rule"]>) { onChange({ ...form, reminder_rule: { ...form.reminder_rule, ...value } }); }
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/35 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl" onSubmit={onSubmit}><header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-5 py-4"><h2 className="text-base font-semibold">{editing ? text.formEdit : text.formCreate}</h2><Button type="button" variant="ghost" size="icon" aria-label={text.cancel} onClick={onClose}><X className="size-5" /></Button></header><div className="grid gap-5 p-5 sm:grid-cols-2"><Field label={text.name} className="sm:col-span-2"><input aria-label={text.name} className={inputClass} required value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} /></Field><Field label={text.category}><select aria-label={text.category} className={inputClass} required value={form.category_id} onChange={(event) => { const categoryId = event.target.value; onChange({ ...form, category_id: categoryId, platform_id: overview.platforms.find((item) => item.category_id === categoryId)?.id ?? "" }); }}>{overview.categories.map((item) => <option key={item.id} value={item.id}>{localeName(item, locale)}</option>)}</select></Field><Field label={text.platform}><select aria-label={text.platform} className={inputClass} required value={form.platform_id} onChange={(event) => onChange({ ...form, platform_id: event.target.value })}>{platforms.map((item) => <option key={item.id} value={item.id}>{localeName(item, locale)}</option>)}</select></Field><Field label={text.descriptionLabel} className="sm:col-span-2"><textarea aria-label={text.descriptionLabel} className="min-h-24 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]" placeholder={text.descriptionPlaceholder} value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} /></Field><Field label={text.priority}><select aria-label={text.priority} className={inputClass} value={form.priority} onChange={(event) => onChange({ ...form, priority: event.target.value as ActivityPlanInput["priority"] })}>{Object.entries(text.priorities).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label={text.status}><select aria-label={text.status} className={inputClass} value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as ActivityPlanInput["status"] })}>{Object.entries(text.statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label={text.startDate}><DateInput aria-label={text.startDate} className={inputClass} locale={locale} required value={form.start_date} onChange={(value) => onChange({ ...form, start_date: value })} /></Field><Field label={text.endDate}><DateInput aria-label={text.endDate} className={inputClass} locale={locale} min={form.start_date} value={form.end_date ?? ""} onChange={(value) => onChange({ ...form, end_date: value || null })} /></Field><Field label={text.owner}><select aria-label={text.owner} className={inputClass} value={form.owner_id ?? ""} onChange={(event) => onChange({ ...form, owner_id: event.target.value || null })}><option value="">{text.unassigned}</option>{overview.owner_options.map((item) => <option key={item.id} value={item.id}>{[item.first_name, item.last_name].filter(Boolean).join(" ") || item.username || item.email}</option>)}</select></Field><Field label={text.time}><input aria-label={text.time} className={inputClass} type="time" required value={form.reminder_rule.reminder_time} onChange={(event) => setRule({ reminder_time: event.target.value })} /></Field><Field label={text.frequency} className="sm:col-span-2"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(Object.keys(text.frequencies) as ActivityFrequency[]).map((frequency) => <button key={frequency} type="button" className={cn("h-10 rounded-lg border text-sm", form.reminder_rule.frequency === frequency ? "border-[var(--primary)] bg-[var(--primary-soft)] font-medium text-[var(--primary)]" : "border-[var(--border)] text-[var(--muted)]")} onClick={() => setRule({ frequency, weekdays: frequency === "WEEKLY" && !form.reminder_rule.weekdays.length ? [1] : form.reminder_rule.weekdays, month_days: frequency === "MONTHLY" && !form.reminder_rule.month_days.length ? [1] : form.reminder_rule.month_days })}>{text.frequencies[frequency]}</button>)}</div></Field>{form.reminder_rule.frequency !== "ONCE" ? <Field label={text.interval}><div className="flex items-center gap-2"><input aria-label={text.interval} className={inputClass} type="number" min={1} max={52} required value={form.reminder_rule.interval} onChange={(event) => setRule({ interval: Number(event.target.value) })} /><span className="shrink-0 text-sm text-[var(--muted)]">{text.intervalUnit[form.reminder_rule.frequency]}</span></div></Field> : null}{form.reminder_rule.frequency === "WEEKLY" ? <Field label={text.frequency} className="sm:col-span-2"><div className="flex flex-wrap gap-2">{text.weekdays.map((label, index) => { const day = index + 1; const selected = form.reminder_rule.weekdays.includes(day); return <button key={label} type="button" aria-pressed={selected} className={cn("h-9 min-w-12 rounded-lg border px-3 text-sm", selected ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)]")} onClick={() => setRule({ weekdays: selected ? form.reminder_rule.weekdays.filter((item) => item !== day) : [...form.reminder_rule.weekdays, day].sort() })}>{label}</button>; })}</div></Field> : null}{form.reminder_rule.frequency === "MONTHLY" ? <Field label={text.monthDays} className="sm:col-span-2"><div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">{Array.from({ length: 31 }, (_, index) => index + 1).map((day) => { const selected = form.reminder_rule.month_days.includes(day); return <button key={day} type="button" aria-pressed={selected} className={cn("aspect-square rounded-md border text-xs", selected ? "border-[var(--primary)] bg-[var(--primary-soft)] font-medium text-[var(--primary)]" : "border-[var(--border)]")} onClick={() => setRule({ month_days: selected ? form.reminder_rule.month_days.filter((item) => item !== day) : [...form.reminder_rule.month_days, day].sort((a, b) => a - b) })}>{day}</button>; })}</div></Field> : null}</div><footer className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--card)] px-5 py-4"><Button type="button" variant="outline" onClick={onClose}>{text.cancel}</Button><Button type="submit" disabled={saving || !form.category_id || !form.platform_id || (form.reminder_rule.frequency === "WEEKLY" && !form.reminder_rule.weekdays.length) || (form.reminder_rule.frequency === "MONTHLY" && !form.reminder_rule.month_days.length)}>{saving ? text.saving : text.save}</Button></footer></form></div>;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) { return <div className={cn("space-y-1.5", className)}><span className="block text-xs font-medium text-[var(--muted)]">{label}</span>{children}</div>; }
function localeName(value: { name_zh?: string; name_en?: string } | null | undefined, locale: "zh-CN" | "en-GB") { return locale === "zh-CN" ? value?.name_zh ?? "—" : value?.name_en ?? "—"; }
function formatDateTime(value: string, locale: "zh-CN" | "en-GB") { return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function categoryColour(value?: string) { return ({ blue: "#0071e3", rose: "#d70015", amber: "#b25000", green: "#248a3d", violet: "#8944ab" } as Record<string, string>)[value ?? ""] ?? "#6e6e73"; }
function repeatLabel(plan: ActivityPlan, text: Text) { const rule = plan.reminder_rule; if (rule.frequency === "WEEKLY") return `${text.frequencies.WEEKLY} · ${rule.weekdays.map((day) => text.weekdays[day - 1]).join("、")}`; if (rule.frequency === "MONTHLY") return `${text.frequencies.MONTHLY} · ${rule.month_days.join(", ")}`; return text.frequencies[rule.frequency]; }
function StatusBadge({ label, status }: { label: string; status: string }) { const tone = status === "OVERDUE" || status === "URGENT" ? "bg-rose-50 text-rose-700" : status === "ACTIVE" || status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : status === "PENDING" ? "bg-blue-50 text-blue-700" : "bg-[var(--surface-muted)] text-[var(--muted)]"; return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", tone)}>{label}</span>; }
