"use client";

import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { enGB, zhCN } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  List as ListIcon,
  Megaphone,
  PackageSearch,
  Pencil,
  Plus,
  Save,
  Store,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createBusinessClosure,
  createBusinessEvent,
  createEventChecklistItem,
  deleteBusinessClosure,
  deleteBusinessEvent,
  deleteEventChecklistItem,
  getBusinessEvent,
  getEventOverview,
  updateBusinessClosure,
  updateBusinessEvent,
  updateEventChecklistItem,
  type BusinessClosure,
  type BusinessClosureInput,
  type BusinessClosureType,
  type BusinessEvent,
  type BusinessEventDetail,
  type BusinessEventInput,
  type BusinessEventStatus,
  type BusinessEventType,
  type CalendarHoliday,
  type EventChecklistCategory,
  type EventOverview,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type DisplayMode = "calendar" | "list";
type FilterType = "ALL" | "HOLIDAY" | "PROMOTION" | "KOL" | "CUSTOMER" | "PRODUCT" | "MARKETING" | "CLOSED" | "OTHER";
type CalendarEntry =
  | { kind: "EVENT"; id: string; name: string; event: BusinessEvent }
  | { kind: "HOLIDAY"; id: string; name: string; holiday: CalendarHoliday }
  | { kind: "CLOSED"; id: string; name: string; closure: BusinessClosure };
type EventForm = Omit<BusinessEventInput, "preparation_days"> & { preparation_days: string };
type ClosureForm = BusinessClosureInput;

const copy = {
  "zh-CN": {
    title: "活动管理",
    description: "统一管理节假日、经营活动和门店休息或停业安排",
    calendarMode: "日历模式",
    listMode: "列表模式",
    previousYear: "上一年",
    nextYear: "下一年",
    upcoming: "即将到来的活动",
    nextThirty: "未来30天活动",
    inPreparation: "已进入准备期",
    needsAttention: "需要处理",
    addEvent: "新增活动",
    addClosure: "标记停业",
    loading: "正在读取经营日历...",
    loadError: "活动数据加载失败",
    empty: "没有符合筛选条件的记录",
    filters: { ALL: "全部", HOLIDAY: "节假日", PROMOTION: "促销", KOL: "KOL合作", CUSTOMER: "客户活动", PRODUCT: "新品推广", MARKETING: "营销", CLOSED: "休假/停业", OTHER: "其他" },
    weekdays: ["一", "二", "三", "四", "五", "六", "日"],
    more: (count: number) => `另有${count}项`,
    holiday: "节假日",
    closed: "休息 / 停业",
    event: "活动",
    activity: "活动",
    type: "类型",
    startDate: "开始日期",
    duration: "持续时间",
    distance: "距离开始",
    preparation: "准备期",
    status: "当前状态",
    actions: "操作",
    day: (value: number) => `${value}天`,
    startsIn: (value: number) => value === 0 ? "今天" : value > 0 ? `${value}天` : "已开始",
    view: "查看",
    edit: "编辑",
    delete: "删除",
    createRelated: "创建关联活动",
    dayDetails: "当日安排",
    noDayEntries: "当天没有节假日、活动或停业安排",
    eventTypes: {
      PROMOTION: "促销活动", KOL_COLLABORATION: "KOL / 网红合作", CUSTOMER_LOYALTY: "老客户回馈", PRODUCT_LAUNCH: "新品推广", MEMBER_EVENT: "会员活动", MARKETING: "广告 / 营销", SPECIAL_ORDER: "特殊订单", OFFLINE_PARTNERSHIP: "线下合作", OTHER: "其他",
    },
    closureTypes: { REST_DAY: "休息", TEMPORARY_CLOSURE: "临时停业", STAFF_LEAVE: "员工假期", MAINTENANCE: "设备维护", RENOVATION: "装修", OTHER: "其他" },
    statuses: { NOT_PREPARING: "未进入准备期", PREPARING: "准备中", IMMINENT: "临近活动", PREPARATION_RISK: "存在准备风险", COMPLETED: "已完成" },
    impacts: { LOW: "低", MEDIUM: "中", HIGH: "高" },
    formTitleCreate: "新增活动",
    formTitleEdit: "编辑活动",
    eventName: "活动名称",
    eventType: "活动类型",
    endDate: "结束日期",
    preparationDays: "提前准备时间",
    expectedImpact: "预计影响",
    salesChange: "预计销售变化",
    focusProducts: "重点产品",
    estimatedCost: "预计活动成本",
    notes: "备注",
    notesPlaceholder: "填写活动目标、合作方或执行注意事项",
    selectAtLeastOne: "可选择一个或多个产品",
    cancel: "取消",
    save: "保存",
    saving: "正在保存...",
    saved: "活动已保存",
    deleted: "活动已删除",
    deleteConfirm: "确定删除这个活动吗？准备清单也会一并删除。",
    closureTitleCreate: "标记门店休息 / 停业",
    closureTitleEdit: "编辑休息 / 停业安排",
    closureName: "安排名称",
    closureType: "停业类型",
    closureSaved: "停业安排已保存",
    closureDeleted: "停业安排已删除",
    closureDeleteConfirm: "确定删除这个休息或停业安排吗？",
    detailOverview: "活动概览",
    countdown: (value: number) => value === 0 ? "今天开始" : value > 0 ? `还有${value}天` : "活动已开始",
    sales: "预计销售变化",
    cost: "活动成本",
    products: "重点产品",
    noProducts: "尚未选择重点产品",
    productionAdvice: "生产计划建议",
    currentPlan: "当前计划",
    suggestedQuantity: "建议数量",
    suggestedIncrease: "建议增加",
    viewProduction: "查看生产计划",
    inventoryAdvice: "库存准备建议",
    ingredient: "食材",
    currentStock: "当前库存",
    originalDemand: "原计划需求",
    extraDemand: "活动额外需求",
    recommendation: "建议",
    sufficient: "当前库存充足",
    increaseBy: (value: string, unit: string) => `建议增加${value}${unit}`,
    viewInventory: "查看库存管理",
    checklist: "活动准备清单",
    progress: (done: number, total: number) => `${done} / ${total} 已完成`,
    checklistCategories: { PRODUCT_PRODUCTION: "产品与生产", INVENTORY_PURCHASING: "库存与采购", STORE_OPERATIONS: "门店运营", MARKETING: "营销" },
    addChecklist: "添加准备事项",
    checklistPlaceholder: "输入准备事项",
    noAdvice: "没有可计算的建议，请先选择重点产品并确认产品配方。",
    holidayReference: "系统参考信息，不直接修改生产计划或库存",
  },
  "en-GB": {
    title: "Event Management",
    description: "Manage holidays, commercial events and store closures in one business calendar",
    calendarMode: "Calendar",
    listMode: "List",
    previousYear: "Previous year",
    nextYear: "Next year",
    upcoming: "Upcoming events",
    nextThirty: "Events in 30 days",
    inPreparation: "In preparation",
    needsAttention: "Needs attention",
    addEvent: "Add event",
    addClosure: "Mark closure",
    loading: "Loading the business calendar...",
    loadError: "Unable to load events",
    empty: "No records match this filter",
    filters: { ALL: "All", HOLIDAY: "Holidays", PROMOTION: "Promotions", KOL: "KOL collaborations", CUSTOMER: "Customer events", PRODUCT: "Product launches", MARKETING: "Marketing", CLOSED: "Leave / closed", OTHER: "Other" },
    weekdays: ["M", "T", "W", "T", "F", "S", "S"],
    more: (count: number) => `${count} more`,
    holiday: "Holiday",
    closed: "Closed",
    event: "Event",
    activity: "Activity",
    type: "Type",
    startDate: "Start date",
    duration: "Duration",
    distance: "Starts in",
    preparation: "Preparation",
    status: "Status",
    actions: "Actions",
    day: (value: number) => `${value} day${value === 1 ? "" : "s"}`,
    startsIn: (value: number) => value === 0 ? "Today" : value > 0 ? `${value} days` : "Started",
    view: "View",
    edit: "Edit",
    delete: "Delete",
    createRelated: "Create related event",
    dayDetails: "Day details",
    noDayEntries: "No holiday, event or closure on this date",
    eventTypes: {
      PROMOTION: "Promotion", KOL_COLLABORATION: "KOL collaboration", CUSTOMER_LOYALTY: "Customer loyalty", PRODUCT_LAUNCH: "Product launch", MEMBER_EVENT: "Member event", MARKETING: "Advertising / marketing", SPECIAL_ORDER: "Special order", OFFLINE_PARTNERSHIP: "Offline partnership", OTHER: "Other",
    },
    closureTypes: { REST_DAY: "Rest day", TEMPORARY_CLOSURE: "Temporary closure", STAFF_LEAVE: "Staff leave", MAINTENANCE: "Equipment maintenance", RENOVATION: "Renovation", OTHER: "Other" },
    statuses: { NOT_PREPARING: "Not in preparation", PREPARING: "Preparing", IMMINENT: "Imminent", PREPARATION_RISK: "Preparation risk", COMPLETED: "Completed" },
    impacts: { LOW: "Low", MEDIUM: "Medium", HIGH: "High" },
    formTitleCreate: "Add event",
    formTitleEdit: "Edit event",
    eventName: "Event name",
    eventType: "Event type",
    endDate: "End date",
    preparationDays: "Preparation lead time",
    expectedImpact: "Expected impact",
    salesChange: "Expected sales change",
    focusProducts: "Focus products",
    estimatedCost: "Estimated event cost",
    notes: "Notes",
    notesPlaceholder: "Record objectives, partners or execution notes",
    selectAtLeastOne: "Select one or more products",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    saved: "Event saved",
    deleted: "Event deleted",
    deleteConfirm: "Delete this event and its preparation checklist?",
    closureTitleCreate: "Mark store leave / closure",
    closureTitleEdit: "Edit leave / closure",
    closureName: "Schedule name",
    closureType: "Closure type",
    closureSaved: "Closure saved",
    closureDeleted: "Closure deleted",
    closureDeleteConfirm: "Delete this leave or closure schedule?",
    detailOverview: "Event overview",
    countdown: (value: number) => value === 0 ? "Starts today" : value > 0 ? `${value} days to go` : "Event started",
    sales: "Expected sales change",
    cost: "Event cost",
    products: "Focus products",
    noProducts: "No focus products selected",
    productionAdvice: "Production plan suggestions",
    currentPlan: "Current plan",
    suggestedQuantity: "Suggested quantity",
    suggestedIncrease: "Suggested increase",
    viewProduction: "View production plan",
    inventoryAdvice: "Inventory preparation suggestions",
    ingredient: "Ingredient",
    currentStock: "Current stock",
    originalDemand: "Original demand",
    extraDemand: "Extra event demand",
    recommendation: "Recommendation",
    sufficient: "Current stock is sufficient",
    increaseBy: (value: string, unit: string) => `Add ${value}${unit}`,
    viewInventory: "View inventory management",
    checklist: "Event preparation checklist",
    progress: (done: number, total: number) => `${done} / ${total} complete`,
    checklistCategories: { PRODUCT_PRODUCTION: "Products and production", INVENTORY_PURCHASING: "Inventory and purchasing", STORE_OPERATIONS: "Store operations", MARKETING: "Marketing" },
    addChecklist: "Add preparation item",
    checklistPlaceholder: "Enter a preparation item",
    noAdvice: "No suggestions can be calculated. Select focus products and confirm their recipes.",
    holidayReference: "System reference only; it does not change production plans or inventory",
  },
} as const;

const eventTone: Record<BusinessEventStatus, string> = {
  NOT_PREPARING: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  PREPARING: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  IMMINENT: "bg-amber-50 text-amber-700 ring-amber-200",
  PREPARATION_RISK: "bg-rose-50 text-rose-700 ring-rose-200",
  COMPLETED: "bg-blue-50 text-blue-700 ring-blue-200",
};
const inputClass = "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]";

export function EventManagementPage() {
  const { locale } = useAppPreferences();
  const { showSuccess } = useToast();
  const text = copy[locale];
  const dateLocale = locale === "en-GB" ? enGB : zhCN;
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [mode, setMode] = useState<DisplayMode>("calendar");
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [overview, setOverview] = useState<EventOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventDetail, setEventDetail] = useState<BusinessEventDetail | null>(null);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BusinessEvent | null>(null);
  const [eventForm, setEventForm] = useState<EventForm>(() => emptyEventForm());
  const [closureFormOpen, setClosureFormOpen] = useState(false);
  const [editingClosure, setEditingClosure] = useState<BusinessClosure | null>(null);
  const [closureForm, setClosureForm] = useState<ClosureForm>(() => emptyClosureForm());
  const [saving, setSaving] = useState(false);
  const [checklistCategory, setChecklistCategory] = useState<EventChecklistCategory>("PRODUCT_PRODUCTION");
  const [checklistTitle, setChecklistTitle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setOverview(await getEventOverview(year)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : text.loadError); }
    finally { setLoading(false); }
  }, [text.loadError, year]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const loadDetail = useCallback(async (eventId: string) => {
    try { setEventDetail(await getBusinessEvent(eventId)); }
    catch (detailError) { setError(detailError instanceof Error ? detailError.message : text.loadError); }
  }, [text.loadError]);

  useEffect(() => {
    if (!selectedEventId) return;
    const timer = window.setTimeout(() => void loadDetail(selectedEventId), 0);
    return () => window.clearTimeout(timer);
  }, [loadDetail, selectedEventId]);

  const visibleEvents = useMemo(() => (overview?.events ?? []).filter((event) => matchesFilter(filter, "EVENT", event.event_type)), [filter, overview?.events]);
  const visibleHolidays = useMemo(() => filter === "ALL" || filter === "HOLIDAY" ? overview?.holidays ?? [] : [], [filter, overview?.holidays]);
  const visibleClosures = useMemo(() => filter === "ALL" || filter === "CLOSED" ? overview?.closures ?? [] : [], [filter, overview?.closures]);
  const listEntries = useMemo(() => buildListEntries(visibleEvents, visibleHolidays, visibleClosures, locale), [locale, visibleClosures, visibleEvents, visibleHolidays]);

  function openCreateEvent(date = dateKey(new Date()), holidayId: string | null = null) {
    setEditingEvent(null);
    setEventForm({ ...emptyEventForm(date), linked_holiday_id: holidayId });
    setEventFormOpen(true);
  }

  function openEditEvent(event: BusinessEvent) {
    setEditingEvent(event);
    setEventForm({
      name: event.name, event_type: event.event_type, start_date: event.start_date, end_date: event.end_date,
      preparation_days: String(event.preparation_days), expected_impact: event.expected_impact,
      expected_sales_change: event.expected_sales_change, focus_product_ids: event.focus_products.map((product) => product.id),
      estimated_cost: event.estimated_cost, currency: event.currency, notes: event.notes,
      linked_holiday_id: event.linked_holiday_id,
    });
    setEventFormOpen(true);
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const input: BusinessEventInput = { ...eventForm, preparation_days: Number(eventForm.preparation_days), estimated_cost: eventForm.estimated_cost || null };
    try {
      if (editingEvent) await updateBusinessEvent(editingEvent.id, input); else await createBusinessEvent(input);
      setEventFormOpen(false); showSuccess(text.saved); await load();
      if (editingEvent?.id === selectedEventId) await loadDetail(editingEvent.id);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : text.loadError); }
    finally { setSaving(false); }
  }

  async function removeEvent(event: BusinessEvent) {
    if (!window.confirm(text.deleteConfirm)) return;
    await deleteBusinessEvent(event.id); setSelectedEventId(null); setEventFormOpen(false); showSuccess(text.deleted); await load();
  }

  function openCreateClosure(date = dateKey(new Date())) { setEditingClosure(null); setClosureForm(emptyClosureForm(date)); setClosureFormOpen(true); }
  function openEditClosure(closure: BusinessClosure) { setEditingClosure(closure); setClosureForm({ name: closure.name, closure_type: closure.closure_type, start_date: closure.start_date, end_date: closure.end_date, notes: closure.notes }); setClosureFormOpen(true); }

  async function saveClosure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try {
      if (editingClosure) await updateBusinessClosure(editingClosure.id, closureForm); else await createBusinessClosure(closureForm);
      setClosureFormOpen(false); showSuccess(text.closureSaved); await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : text.loadError); }
    finally { setSaving(false); }
  }

  async function removeClosure(closure: BusinessClosure) {
    if (!window.confirm(text.closureDeleteConfirm)) return;
    await deleteBusinessClosure(closure.id); setClosureFormOpen(false); showSuccess(text.closureDeleted); await load();
  }

  async function toggleChecklist(itemId: string, completed: boolean) {
    await updateEventChecklistItem(itemId, { is_completed: completed });
    if (selectedEventId) await loadDetail(selectedEventId); await load();
  }

  async function addChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedEventId || !checklistTitle.trim()) return;
    await createEventChecklistItem(selectedEventId, locale === "en-GB" ? { category: checklistCategory, title_en: checklistTitle.trim() } : { category: checklistCategory, title_zh: checklistTitle.trim() });
    setChecklistTitle(""); await loadDetail(selectedEventId); await load();
  }

  async function removeChecklist(itemId: string) { await deleteEventChecklistItem(itemId); if (selectedEventId) await loadDetail(selectedEventId); await load(); }

  const kpis = overview?.kpis;
  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div><PageBreadcrumb fallback={{ zh: text.title, en: text.title }} /><p className="mt-1.5 text-sm text-[var(--muted)]">{text.description}</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openCreateClosure()}><Store className="size-4" />{text.addClosure}</Button><Button onClick={() => openCreateEvent()}><Plus className="size-4" />{text.addEvent}</Button></div>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric label={text.upcoming} value={kpis?.upcoming_count ?? 0} icon={CalendarDays} tone="blue" />
          <Metric label={text.nextThirty} value={kpis?.next_30_days_count ?? 0} icon={Megaphone} tone="violet" />
          <Metric label={text.inPreparation} value={kpis?.in_preparation_count ?? 0} icon={ClipboardCheck} tone="green" />
          <Metric label={text.needsAttention} value={kpis?.needs_attention_count ?? 0} icon={AlertTriangle} tone="rose" />
        </section>

        {error ? <button className="mb-4 w-full rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-left text-sm text-rose-700" onClick={() => setError(null)}>{error}</button> : null}

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label={text.previousYear} onClick={() => setYear((value) => value - 1)}><ChevronLeft className="size-4" /></Button><strong className="min-w-20 text-center text-lg">{year}</strong><Button variant="outline" size="icon" aria-label={text.nextYear} onClick={() => setYear((value) => value + 1)}><ChevronRight className="size-4" /></Button></div>
          <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-1">
            {(["calendar", "list"] as DisplayMode[]).map((item) => <button key={item} type="button" className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm", mode === item ? "bg-[var(--card)] font-medium shadow-sm" : "text-[var(--muted)]")} onClick={() => setMode(item)}>{item === "calendar" ? <CalendarDays className="size-4" /> : <ListIcon className="size-4" />}{item === "calendar" ? text.calendarMode : text.listMode}</button>)}
          </div>
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {(Object.keys(text.filters) as FilterType[]).map((item) => <button key={item} type="button" className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", filter === item ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)]")} onClick={() => setFilter(item)}>{text.filters[item]}</button>)}
        </div>

        {loading ? <Card className="grid min-h-80 place-items-center rounded-lg text-sm text-[var(--muted)]">{text.loading}</Card> : mode === "calendar" ? (
          <YearCalendar year={year} events={visibleEvents} holidays={visibleHolidays} closures={visibleClosures} locale={locale} text={text} dateLocale={dateLocale} onSelectDate={setSelectedDate} />
        ) : <EventList entries={listEntries} locale={locale} text={text} onViewEvent={setSelectedEventId} onEditEvent={openEditEvent} onDeleteEvent={(event) => void removeEvent(event)} onCreateRelated={(holiday) => openCreateEvent(holiday.holiday_date, holiday.id)} onEditClosure={openEditClosure} onDeleteClosure={(closure) => void removeClosure(closure)} />}
      </main>

      {selectedDate ? <DayDrawer date={selectedDate} entries={entriesForDate(selectedDate, visibleEvents, visibleHolidays, visibleClosures, locale)} locale={locale} text={text} onClose={() => setSelectedDate(null)} onViewEvent={(id) => { setSelectedDate(null); setSelectedEventId(id); }} onCreateRelated={(holiday) => { setSelectedDate(null); openCreateEvent(holiday.holiday_date, holiday.id); }} onEditClosure={(closure) => { setSelectedDate(null); openEditClosure(closure); }} onAddEvent={() => { setSelectedDate(null); openCreateEvent(selectedDate); }} onAddClosure={() => { setSelectedDate(null); openCreateClosure(selectedDate); }} /> : null}
      {selectedEventId ? <EventDetailDrawer detail={eventDetail} locale={locale} text={text} checklistCategory={checklistCategory} checklistTitle={checklistTitle} onCategoryChange={setChecklistCategory} onTitleChange={setChecklistTitle} onClose={() => setSelectedEventId(null)} onEdit={() => eventDetail && openEditEvent(eventDetail)} onToggleChecklist={(id, value) => void toggleChecklist(id, value)} onAddChecklist={addChecklist} onDeleteChecklist={(id) => void removeChecklist(id)} /> : null}
      {eventFormOpen ? <EventFormDialog form={eventForm} editing={editingEvent} overview={overview} locale={locale} text={text} saving={saving} onChange={setEventForm} onClose={() => setEventFormOpen(false)} onSubmit={saveEvent} onDelete={editingEvent ? () => void removeEvent(editingEvent) : undefined} /> : null}
      {closureFormOpen ? <ClosureFormDialog form={closureForm} editing={editingClosure} text={text} saving={saving} onChange={setClosureForm} onClose={() => setClosureFormOpen(false)} onSubmit={saveClosure} onDelete={editingClosure ? () => void removeClosure(editingClosure) : undefined} /> : null}
    </DashboardShell>
  );
}

type LocalText = (typeof copy)[keyof typeof copy];

function YearCalendar({ year, events, holidays, closures, locale, text, dateLocale, onSelectDate }: { year: number; events: BusinessEvent[]; holidays: CalendarHoliday[]; closures: BusinessClosure[]; locale: "zh-CN" | "en-GB"; text: LocalText; dateLocale: typeof zhCN; onSelectDate: (date: string) => void }) {
  const months = eachMonthOfInterval({ start: startOfYear(new Date(year, 0, 1)), end: endOfYear(new Date(year, 0, 1)) });
  return <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">{months.map((month) => <Card key={month.toISOString()} className="overflow-hidden rounded-lg"><h2 className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">{format(month, "MMMM", { locale: dateLocale })}</h2><div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-muted)] text-center text-[11px] text-[var(--muted)]">{text.weekdays.map((day, index) => <span key={`${day}-${index}`} className="py-1.5">{day}</span>)}</div><MonthGrid month={month} events={events} holidays={holidays} closures={closures} locale={locale} text={text} onSelectDate={onSelectDate} /></Card>)}</div>;
}

function MonthGrid({ month, events, holidays, closures, locale, text, onSelectDate }: { month: Date; events: BusinessEvent[]; holidays: CalendarHoliday[]; closures: BusinessClosure[]; locale: "zh-CN" | "en-GB"; text: LocalText; onSelectDate: (date: string) => void }) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  return <div className="grid grid-cols-7">{days.map((day) => { const key = dateKey(day); const entries = entriesForDate(key, events, holidays, closures, locale); return <button key={key} type="button" className={cn("relative min-h-16 overflow-hidden border-r border-b border-[var(--border)] p-1.5 text-left last:border-r-0 sm:min-h-20", !isSameMonth(day, month) && "bg-[var(--surface-muted)]/45 text-[var(--muted)]")} onClick={() => onSelectDate(key)}><span className="text-xs tabular-nums">{format(day, "d")}</span><div className="mt-1 space-y-1">{entries.slice(0, 2).map((entry) => <div key={`${entry.kind}-${entry.id}`} className="flex min-w-0 items-center gap-1"><span className={cn("size-1.5 shrink-0 rounded-full", entry.kind === "HOLIDAY" ? "bg-blue-500" : entry.kind === "CLOSED" ? "bg-zinc-500" : "bg-rose-500")} /><span className="hidden truncate text-[10px] sm:block">{entry.name}</span></div>)}{entries.length > 2 ? <span className="text-[9px] text-[var(--muted)]">{text.more(entries.length - 2)}</span> : null}</div></button>; })}</div>;
}

function EventList({ entries, locale, text, onViewEvent, onEditEvent, onDeleteEvent, onCreateRelated, onEditClosure, onDeleteClosure }: { entries: CalendarEntry[]; locale: "zh-CN" | "en-GB"; text: LocalText; onViewEvent: (id: string) => void; onEditEvent: (event: BusinessEvent) => void; onDeleteEvent: (event: BusinessEvent) => void; onCreateRelated: (holiday: CalendarHoliday) => void; onEditClosure: (closure: BusinessClosure) => void; onDeleteClosure: (closure: BusinessClosure) => void }) {
  if (!entries.length) return <Card className="grid min-h-72 place-items-center rounded-lg text-sm text-[var(--muted)]">{text.empty}</Card>;
  return <Card className="overflow-hidden rounded-lg"><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-[var(--surface-muted)] text-xs text-[var(--muted)]"><tr><th className="px-4 py-3">{text.activity}</th><th className="px-4 py-3">{text.type}</th><th className="px-4 py-3">{text.startDate}</th><th className="px-4 py-3">{text.duration}</th><th className="px-4 py-3">{text.distance}</th><th className="px-4 py-3">{text.preparation}</th><th className="px-4 py-3">{text.status}</th><th className="px-4 py-3 text-right">{text.actions}</th></tr></thead><tbody>{entries.map((entry) => <ListRow key={`${entry.kind}-${entry.id}`} entry={entry} locale={locale} text={text} onViewEvent={onViewEvent} onEditEvent={onEditEvent} onDeleteEvent={onDeleteEvent} onCreateRelated={onCreateRelated} onEditClosure={onEditClosure} onDeleteClosure={onDeleteClosure} />)}</tbody></table></div><div className="divide-y divide-[var(--border)] md:hidden">{entries.map((entry) => <MobileListRow key={`${entry.kind}-${entry.id}`} entry={entry} locale={locale} text={text} onViewEvent={onViewEvent} onCreateRelated={onCreateRelated} onEditClosure={onEditClosure} />)}</div></Card>;
}

function ListRow({ entry, locale, text, onViewEvent, onEditEvent, onDeleteEvent, onCreateRelated, onEditClosure, onDeleteClosure }: { entry: CalendarEntry; locale: "zh-CN" | "en-GB"; text: LocalText; onViewEvent: (id: string) => void; onEditEvent: (event: BusinessEvent) => void; onDeleteEvent: (event: BusinessEvent) => void; onCreateRelated: (holiday: CalendarHoliday) => void; onEditClosure: (closure: BusinessClosure) => void; onDeleteClosure: (closure: BusinessClosure) => void }) {
  const meta = entryMeta(entry, locale, text); return <tr className="border-t border-[var(--border)]"><td className="px-4 py-3 font-medium">{entry.name}</td><td className="px-4 py-3">{meta.type}</td><td className="px-4 py-3">{formatDate(meta.start, locale)}</td><td className="px-4 py-3">{text.day(meta.duration)}</td><td className="px-4 py-3">{text.startsIn(meta.distance)}</td><td className="px-4 py-3">{meta.preparation === null ? "—" : text.day(meta.preparation)}</td><td className="px-4 py-3">{entry.kind === "EVENT" ? <StatusBadge status={entry.event.status} label={text.statuses[entry.event.status]} /> : <KindBadge kind={entry.kind} label={entry.kind === "HOLIDAY" ? text.holiday : text.closed} />}</td><td className="px-4 py-3"><div className="flex justify-end gap-1">{entry.kind === "EVENT" ? <><Button variant="ghost" className="h-8 px-2" onClick={() => onViewEvent(entry.id)}>{text.view}</Button><Button variant="ghost" size="icon" className="size-8" aria-label={text.edit} onClick={() => onEditEvent(entry.event)}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-8 text-rose-600" aria-label={text.delete} onClick={() => onDeleteEvent(entry.event)}><Trash2 className="size-3.5" /></Button></> : entry.kind === "HOLIDAY" ? <Button variant="ghost" className="h-8 px-2" onClick={() => onCreateRelated(entry.holiday)}>{text.createRelated}</Button> : <><Button variant="ghost" size="icon" className="size-8" aria-label={text.edit} onClick={() => onEditClosure(entry.closure)}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-8 text-rose-600" aria-label={text.delete} onClick={() => onDeleteClosure(entry.closure)}><Trash2 className="size-3.5" /></Button></>}</div></td></tr>;
}

function MobileListRow({ entry, locale, text, onViewEvent, onCreateRelated, onEditClosure }: { entry: CalendarEntry; locale: "zh-CN" | "en-GB"; text: LocalText; onViewEvent: (id: string) => void; onCreateRelated: (holiday: CalendarHoliday) => void; onEditClosure: (closure: BusinessClosure) => void }) { const meta = entryMeta(entry, locale, text); return <button type="button" className="w-full px-4 py-4 text-left" onClick={() => entry.kind === "EVENT" ? onViewEvent(entry.id) : entry.kind === "HOLIDAY" ? onCreateRelated(entry.holiday) : onEditClosure(entry.closure)}><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{entry.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{meta.type} · {formatDate(meta.start, locale)} · {text.day(meta.duration)}</p></div>{entry.kind === "EVENT" ? <StatusBadge status={entry.event.status} label={text.statuses[entry.event.status]} /> : <KindBadge kind={entry.kind} label={entry.kind === "HOLIDAY" ? text.holiday : text.closed} />}</div></button>; }

function DayDrawer({ date, entries, locale, text, onClose, onViewEvent, onCreateRelated, onEditClosure, onAddEvent, onAddClosure }: { date: string; entries: CalendarEntry[]; locale: "zh-CN" | "en-GB"; text: LocalText; onClose: () => void; onViewEvent: (id: string) => void; onCreateRelated: (holiday: CalendarHoliday) => void; onEditClosure: (closure: BusinessClosure) => void; onAddEvent: () => void; onAddClosure: () => void }) { return <Drawer title={formatLongDate(date, locale)} onClose={onClose} closeLabel={text.cancel}><div className="space-y-3 p-4 sm:p-6">{entries.length ? entries.map((entry) => <button key={`${entry.kind}-${entry.id}`} type="button" className="w-full rounded-lg border border-[var(--border)] p-4 text-left hover:bg-[var(--surface-muted)]" onClick={() => entry.kind === "EVENT" ? onViewEvent(entry.id) : entry.kind === "HOLIDAY" ? onCreateRelated(entry.holiday) : onEditClosure(entry.closure)}><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{entry.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{entry.kind === "EVENT" ? text.eventTypes[entry.event.event_type] : entry.kind === "HOLIDAY" ? text.holiday : text.closureTypes[entry.closure.closure_type]}</p></div><KindBadge kind={entry.kind} label={entry.kind === "EVENT" ? text.event : entry.kind === "HOLIDAY" ? text.holiday : text.closed} /></div>{entry.kind === "HOLIDAY" ? <p className="mt-3 text-xs text-[var(--muted)]">{text.holidayReference}</p> : null}</button>) : <p className="py-10 text-center text-sm text-[var(--muted)]">{text.noDayEntries}</p>}<div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={onAddClosure}><Store className="size-4" />{text.addClosure}</Button><Button className="flex-1" onClick={onAddEvent}><Plus className="size-4" />{text.addEvent}</Button></div></div></Drawer>; }

function EventDetailDrawer({ detail, locale, text, checklistCategory, checklistTitle, onCategoryChange, onTitleChange, onClose, onEdit, onToggleChecklist, onAddChecklist, onDeleteChecklist }: { detail: BusinessEventDetail | null; locale: "zh-CN" | "en-GB"; text: LocalText; checklistCategory: EventChecklistCategory; checklistTitle: string; onCategoryChange: (value: EventChecklistCategory) => void; onTitleChange: (value: string) => void; onClose: () => void; onEdit: () => void; onToggleChecklist: (id: string, value: boolean) => void; onAddChecklist: (event: FormEvent<HTMLFormElement>) => void; onDeleteChecklist: (id: string) => void }) {
  return <Drawer title={detail?.name ?? text.loading} onClose={onClose} closeLabel={text.cancel} wide headerAction={detail ? <Button variant="outline" onClick={onEdit}><Pencil className="size-4" />{text.edit}</Button> : null}>{detail ? <div className="space-y-8 p-4 sm:p-6"><section><div className="flex flex-wrap items-center gap-2"><StatusBadge status={detail.status} label={text.statuses[detail.status]} /><span className="text-sm text-[var(--muted)]">{text.countdown(detail.days_until_start)}</span></div><p className="mt-3 text-lg font-semibold">{formatLongDate(detail.start_date, locale)}{detail.end_date !== detail.start_date ? ` - ${formatDate(detail.end_date, locale)}` : ""}</p><div className="mt-4 grid grid-cols-2 border-y border-[var(--border)] sm:grid-cols-4"><Info label={text.type} value={text.eventTypes[detail.event_type]} /><Info label={text.expectedImpact} value={text.impacts[detail.expected_impact]} /><Info label={text.sales} value={`${Number(detail.expected_sales_change) >= 0 ? "+" : ""}${detail.expected_sales_change}%`} /><Info label={text.cost} value={detail.estimated_cost ? formatCurrency(detail.estimated_cost, detail.currency, locale) : "—"} /></div><div className="mt-4"><p className="text-xs text-[var(--muted)]">{text.products}</p><div className="mt-2 flex flex-wrap gap-2">{detail.focus_products.length ? detail.focus_products.map((product) => <span key={product.id} className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-[var(--primary)]">{locale === "en-GB" ? product.name_en : product.name_zh}</span>) : <span className="text-sm text-[var(--muted)]">{text.noProducts}</span>}</div></div></section><AdviceSection detail={detail} locale={locale} text={text} /><ChecklistSection detail={detail} locale={locale} text={text} category={checklistCategory} title={checklistTitle} onCategoryChange={onCategoryChange} onTitleChange={onTitleChange} onToggle={onToggleChecklist} onAdd={onAddChecklist} onDelete={onDeleteChecklist} /></div> : <div className="grid min-h-80 place-items-center text-sm text-[var(--muted)]">{text.loading}</div>}</Drawer>;
}

function AdviceSection({ detail, locale, text }: { detail: BusinessEventDetail; locale: "zh-CN" | "en-GB"; text: LocalText }) { return <><section><div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4 text-[var(--primary)]" />{text.productionAdvice}</h3><Link href="/planning/production" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)]">{text.viewProduction}<ExternalLink className="size-3.5" /></Link></div>{detail.production_suggestions.length ? <div className="mt-3 overflow-x-auto border-y border-[var(--border)]"><table className="w-full min-w-[560px] text-sm"><thead className="text-left text-xs text-[var(--muted)]"><tr><th className="py-2 pr-3">{text.products}</th><th className="px-3 py-2">{text.currentPlan}</th><th className="px-3 py-2">{text.suggestedQuantity}</th><th className="py-2 pl-3">{text.suggestedIncrease}</th></tr></thead><tbody>{detail.production_suggestions.map((item) => <tr key={item.product_id} className="border-t border-[var(--border)]"><td className="py-3 pr-3 font-medium">{locale === "en-GB" ? item.product_name_en : item.product_name_zh}</td><td className="px-3 py-3 tabular-nums">{item.current_quantity}</td><td className="px-3 py-3 tabular-nums">{item.suggested_quantity}</td><td className="py-3 pl-3 font-medium text-emerald-600">+{item.suggested_increase}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-[var(--muted)]">{text.noAdvice}</p>}</section><section><div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><PackageSearch className="size-4 text-[var(--primary)]" />{text.inventoryAdvice}</h3><Link href="/operations/inventory" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)]">{text.viewInventory}<ExternalLink className="size-3.5" /></Link></div>{detail.inventory_suggestions.length ? <div className="mt-3 overflow-x-auto border-y border-[var(--border)]"><table className="w-full min-w-[720px] text-sm"><thead className="text-left text-xs text-[var(--muted)]"><tr><th className="py-2 pr-3">{text.ingredient}</th><th className="px-3 py-2">{text.currentStock}</th><th className="px-3 py-2">{text.originalDemand}</th><th className="px-3 py-2">{text.extraDemand}</th><th className="py-2 pl-3">{text.recommendation}</th></tr></thead><tbody>{detail.inventory_suggestions.map((item) => <tr key={item.ingredient_id} className="border-t border-[var(--border)]"><td className="py-3 pr-3 font-medium">{item.ingredient_name}</td><td className="px-3 py-3">{formatQty(item.current_stock, item.unit, locale)}</td><td className="px-3 py-3">{formatQty(item.original_demand, item.unit, locale)}</td><td className="px-3 py-3">+{formatQty(item.extra_demand, item.unit, locale)}</td><td className={cn("py-3 pl-3", item.recommendation === "INCREASE" ? "text-amber-700" : "text-emerald-700")}>{item.recommendation === "INCREASE" ? text.increaseBy(item.recommended_additional_quantity, item.unit) : text.sufficient}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-[var(--muted)]">{text.noAdvice}</p>}</section></>; }

function ChecklistSection({ detail, locale, text, category, title, onCategoryChange, onTitleChange, onToggle, onAdd, onDelete }: { detail: BusinessEventDetail; locale: "zh-CN" | "en-GB"; text: LocalText; category: EventChecklistCategory; title: string; onCategoryChange: (value: EventChecklistCategory) => void; onTitleChange: (value: string) => void; onToggle: (id: string, value: boolean) => void; onAdd: (event: FormEvent<HTMLFormElement>) => void; onDelete: (id: string) => void }) { const groups = Object.keys(text.checklistCategories) as EventChecklistCategory[]; return <section><div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="size-4 text-[var(--primary)]" />{text.checklist}</h3><span className="text-xs text-[var(--muted)]">{text.progress(detail.checklist_completed, detail.checklist_total)}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full bg-emerald-500" style={{ width: `${detail.checklist_total ? detail.checklist_completed / detail.checklist_total * 100 : 0}%` }} /></div><div className="mt-5 space-y-5">{groups.map((group) => { const items = detail.checklist_items.filter((item) => item.category === group); return <div key={group}><h4 className="text-xs font-semibold text-[var(--muted)]">{text.checklistCategories[group]}</h4><div className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">{items.map((item) => <div key={item.id} className="flex items-center gap-3 py-2.5"><button type="button" className={cn("grid size-5 shrink-0 place-items-center rounded border", item.is_completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-[var(--border)]")} aria-label={locale === "en-GB" ? item.title_en : item.title_zh} onClick={() => onToggle(item.id, !item.is_completed)}>{item.is_completed ? <Check className="size-3.5" /> : null}</button><span className={cn("min-w-0 flex-1 text-sm", item.is_completed && "text-[var(--muted)] line-through")}>{locale === "en-GB" ? item.title_en : item.title_zh}</span><Button variant="ghost" size="icon" className="size-8" aria-label={text.delete} onClick={() => onDelete(item.id)}><Trash2 className="size-3.5" /></Button></div>)}</div></div>; })}</div><form className="mt-5 grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto]" onSubmit={onAdd}><select value={category} className={inputClass} onChange={(event) => onCategoryChange(event.target.value as EventChecklistCategory)}>{groups.map((group) => <option key={group} value={group}>{text.checklistCategories[group]}</option>)}</select><input value={title} className={inputClass} placeholder={text.checklistPlaceholder} onChange={(event) => onTitleChange(event.target.value)} /><Button type="submit" disabled={!title.trim()}><Plus className="size-4" />{text.addChecklist}</Button></form></section>; }

function EventFormDialog({ form, editing, overview, locale, text, saving, onChange, onClose, onSubmit, onDelete }: { form: EventForm; editing: BusinessEvent | null; overview: EventOverview | null; locale: "zh-CN" | "en-GB"; text: LocalText; saving: boolean; onChange: (value: EventForm) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onDelete?: () => void }) { const toggleProduct = (id: string) => onChange({ ...form, focus_product_ids: form.focus_product_ids.includes(id) ? form.focus_product_ids.filter((item) => item !== id) : [...form.focus_product_ids, id] }); return <Modal title={editing ? text.formTitleEdit : text.formTitleCreate} closeLabel={text.cancel} onClose={onClose}><form onSubmit={onSubmit}><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label={text.eventName} wide><input required value={form.name} className={inputClass} onChange={(event) => onChange({ ...form, name: event.target.value })} /></Field><Field label={text.eventType}><select value={form.event_type} className={inputClass} onChange={(event) => onChange({ ...form, event_type: event.target.value as BusinessEventType })}>{(Object.keys(text.eventTypes) as BusinessEventType[]).map((type) => <option key={type} value={type}>{text.eventTypes[type]}</option>)}</select></Field><Field label={text.expectedImpact}><select value={form.expected_impact} className={inputClass} onChange={(event) => onChange({ ...form, expected_impact: event.target.value as EventForm["expected_impact"] })}>{(["LOW", "MEDIUM", "HIGH"] as const).map((value) => <option key={value} value={value}>{text.impacts[value]}</option>)}</select></Field><Field label={text.startDate}><input required type="date" value={form.start_date} className={inputClass} onChange={(event) => onChange({ ...form, start_date: event.target.value, end_date: form.end_date < event.target.value ? event.target.value : form.end_date })} /></Field><Field label={text.endDate}><input required type="date" min={form.start_date} value={form.end_date} className={inputClass} onChange={(event) => onChange({ ...form, end_date: event.target.value })} /></Field><Field label={text.preparationDays}><input required min="0" max="365" type="number" value={form.preparation_days} className={inputClass} onChange={(event) => onChange({ ...form, preparation_days: event.target.value })} /></Field><Field label={text.salesChange}><div className="flex"><input required type="number" min="-100" max="999.99" step="0.01" value={form.expected_sales_change} className={cn(inputClass, "rounded-r-none")} onChange={(event) => onChange({ ...form, expected_sales_change: event.target.value })} /><span className="grid h-10 w-12 place-items-center rounded-r-lg border border-l-0 border-[var(--border)] bg-[var(--surface-muted)]">%</span></div></Field><Field label={text.estimatedCost}><div className="flex"><span className="grid h-10 w-10 place-items-center rounded-l-lg border border-r-0 border-[var(--border)] bg-[var(--surface-muted)]">£</span><input type="number" min="0" step="0.01" value={form.estimated_cost ?? ""} className={cn(inputClass, "rounded-l-none")} onChange={(event) => onChange({ ...form, estimated_cost: event.target.value })} /></div></Field><Field label={text.focusProducts} wide hint={text.selectAtLeastOne}><div className="grid gap-2 sm:grid-cols-2">{overview?.product_options.map((product) => <label key={product.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"><input type="checkbox" checked={form.focus_product_ids.includes(product.id)} onChange={() => toggleProduct(product.id)} /><span className="truncate">{locale === "en-GB" ? product.name_en : product.name_zh}</span></label>)}</div></Field><Field label={text.notes} wide><textarea rows={3} value={form.notes} className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none" placeholder={text.notesPlaceholder} onChange={(event) => onChange({ ...form, notes: event.target.value })} /></Field>{onDelete ? <Button type="button" variant="ghost" className="justify-self-start text-rose-600" onClick={onDelete}><Trash2 className="size-4" />{text.delete}</Button> : null}</div><ModalFooter text={text} saving={saving} onClose={onClose} /></form></Modal>; }

function ClosureFormDialog({ form, editing, text, saving, onChange, onClose, onSubmit, onDelete }: { form: ClosureForm; editing: BusinessClosure | null; text: LocalText; saving: boolean; onChange: (value: ClosureForm) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onDelete?: () => void }) { return <Modal title={editing ? text.closureTitleEdit : text.closureTitleCreate} closeLabel={text.cancel} onClose={onClose} narrow><form onSubmit={onSubmit}><div className="space-y-4 p-5"><Field label={text.closureName}><input required value={form.name} className={inputClass} onChange={(event) => onChange({ ...form, name: event.target.value })} /></Field><Field label={text.closureType}><select value={form.closure_type} className={inputClass} onChange={(event) => onChange({ ...form, closure_type: event.target.value as BusinessClosureType })}>{(Object.keys(text.closureTypes) as BusinessClosureType[]).map((type) => <option key={type} value={type}>{text.closureTypes[type]}</option>)}</select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label={text.startDate}><input required type="date" value={form.start_date} className={inputClass} onChange={(event) => onChange({ ...form, start_date: event.target.value, end_date: form.end_date < event.target.value ? event.target.value : form.end_date })} /></Field><Field label={text.endDate}><input required type="date" min={form.start_date} value={form.end_date} className={inputClass} onChange={(event) => onChange({ ...form, end_date: event.target.value })} /></Field></div><Field label={text.notes}><textarea rows={3} value={form.notes} className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none" onChange={(event) => onChange({ ...form, notes: event.target.value })} /></Field>{onDelete ? <Button type="button" variant="ghost" className="text-rose-600" onClick={onDelete}><Trash2 className="size-4" />{text.delete}</Button> : null}</div><ModalFooter text={text} saving={saving} onClose={onClose} /></form></Modal>; }

function Modal({ title, closeLabel, onClose, children, narrow = false }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode; narrow?: boolean }) { return <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/35 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={title}><button className="absolute inset-0" aria-label={closeLabel} onClick={onClose} /><section className={cn("relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-2xl", narrow ? "max-w-xl" : "max-w-3xl")}><header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-5 py-4"><h2 className="text-lg font-semibold">{title}</h2><Button variant="ghost" size="icon" className="size-9" aria-label={closeLabel} onClick={onClose}><X className="size-4" /></Button></header>{children}</section></div>; }
function Drawer({ title, onClose, closeLabel, children, wide = false, headerAction }: { title: string; onClose: () => void; closeLabel: string; children: ReactNode; wide?: boolean; headerAction?: ReactNode }) { return <div className="fixed inset-0 z-[80] bg-black/30"><button className="absolute inset-0" aria-label={closeLabel} onClick={onClose} /><aside role="dialog" aria-modal="true" aria-label={title} className={cn("absolute inset-y-0 right-0 flex w-full flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl", wide ? "max-w-4xl" : "max-w-xl")}><header className="flex min-h-20 items-center justify-between gap-3 border-b border-[var(--border)] px-4 sm:px-6"><h2 className="min-w-0 truncate text-lg font-semibold">{title}</h2><div className="flex items-center gap-2">{headerAction}<Button variant="ghost" size="icon" aria-label={closeLabel} onClick={onClose}><X className="size-5" /></Button></div></header><div className="min-h-0 flex-1 overflow-y-auto">{children}</div></aside></div>; }
function ModalFooter({ text, saving, onClose }: { text: LocalText; saving: boolean; onClose: () => void }) { return <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--card)] px-5 py-4"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>{text.cancel}</Button><Button type="submit" disabled={saving}><Save className="size-4" />{saving ? text.saving : text.save}</Button></footer>; }
function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: ReactNode }) { return <label className={cn("block space-y-1.5", wide && "sm:col-span-2")}><span className="flex items-center justify-between gap-3 text-sm font-medium"><span>{label}</span>{hint ? <span className="text-xs font-normal text-[var(--muted)]">{hint}</span> : null}</span>{children}</label>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="border-b border-[var(--border)] p-3 sm:p-4"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>; }
function Metric({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof CalendarDays; tone: "blue" | "violet" | "green" | "rose" }) { const tones = { blue: "bg-[var(--tone-blue-bg)] text-[var(--tone-blue-fg)]", violet: "bg-[var(--tone-violet-bg)] text-[var(--tone-violet-fg)]", green: "bg-[var(--tone-green-bg)] text-[var(--tone-green-fg)]", rose: "bg-[var(--tone-rose-bg)] text-[var(--tone-rose-fg)]" }; return <Card className="rounded-lg p-4"><div className="flex items-center gap-3"><span className={cn("grid size-10 place-items-center rounded-full", tones[tone])}><Icon className="size-4.5" /></span><div><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div></div></Card>; }
function StatusBadge({ status, label }: { status: BusinessEventStatus; label: string }) { return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", eventTone[status])}>{label}</span>; }
function KindBadge({ kind, label }: { kind: CalendarEntry["kind"]; label: string }) { return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", kind === "HOLIDAY" ? "bg-blue-50 text-blue-700" : kind === "CLOSED" ? "bg-zinc-200 text-zinc-700" : "bg-rose-50 text-rose-700")}>{label}</span>; }

function entriesForDate(date: string, events: BusinessEvent[], holidays: CalendarHoliday[], closures: BusinessClosure[], locale: "zh-CN" | "en-GB"): CalendarEntry[] { return [...holidays.filter((item) => item.holiday_date === date).map((holiday): CalendarEntry => ({ kind: "HOLIDAY", id: holiday.id, name: locale === "en-GB" ? holiday.name_en : holiday.name_zh, holiday })), ...events.filter((item) => item.start_date <= date && item.end_date >= date).map((event): CalendarEntry => ({ kind: "EVENT", id: event.id, name: event.name, event })), ...closures.filter((item) => item.start_date <= date && item.end_date >= date).map((closure): CalendarEntry => ({ kind: "CLOSED", id: closure.id, name: closure.name, closure }))]; }
function buildListEntries(events: BusinessEvent[], holidays: CalendarHoliday[], closures: BusinessClosure[], locale: "zh-CN" | "en-GB"): CalendarEntry[] { const today = dateKey(new Date()); return [...events.map((event): CalendarEntry => ({ kind: "EVENT", id: event.id, name: event.name, event })), ...holidays.map((holiday): CalendarEntry => ({ kind: "HOLIDAY", id: holiday.id, name: locale === "en-GB" ? holiday.name_en : holiday.name_zh, holiday })), ...closures.map((closure): CalendarEntry => ({ kind: "CLOSED", id: closure.id, name: closure.name, closure }))].sort((a, b) => { const aDistance = differenceInDays(entryMeta(a, locale, copy[locale]).start, today); const bDistance = differenceInDays(entryMeta(b, locale, copy[locale]).start, today); if (aDistance >= 0 && bDistance < 0) return -1; if (aDistance < 0 && bDistance >= 0) return 1; return aDistance >= 0 ? aDistance - bDistance : bDistance - aDistance; }); }
function entryMeta(entry: CalendarEntry, locale: "zh-CN" | "en-GB", text: LocalText) { const today = dateKey(new Date()); if (entry.kind === "EVENT") return { type: text.eventTypes[entry.event.event_type], start: entry.event.start_date, duration: entry.event.duration_days, distance: differenceInDays(entry.event.start_date, today), preparation: entry.event.preparation_days }; if (entry.kind === "HOLIDAY") return { type: text.holiday, start: entry.holiday.holiday_date, duration: 1, distance: differenceInDays(entry.holiday.holiday_date, today), preparation: null }; return { type: text.closureTypes[entry.closure.closure_type], start: entry.closure.start_date, duration: entry.closure.duration_days, distance: differenceInDays(entry.closure.start_date, today), preparation: null }; }
function matchesFilter(filter: FilterType, kind: CalendarEntry["kind"], type?: BusinessEventType) { if (filter === "ALL") return true; if (filter === "HOLIDAY") return kind === "HOLIDAY"; if (filter === "CLOSED") return kind === "CLOSED"; if (kind !== "EVENT" || !type) return false; if (filter === "PROMOTION") return type === "PROMOTION"; if (filter === "KOL") return type === "KOL_COLLABORATION"; if (filter === "CUSTOMER") return type === "CUSTOMER_LOYALTY" || type === "MEMBER_EVENT"; if (filter === "PRODUCT") return type === "PRODUCT_LAUNCH"; if (filter === "MARKETING") return type === "MARKETING"; return ["SPECIAL_ORDER", "OFFLINE_PARTNERSHIP", "OTHER"].includes(type); }
function emptyEventForm(date = dateKey(new Date())): EventForm { return { name: "", event_type: "PROMOTION", start_date: date, end_date: date, preparation_days: "14", expected_impact: "MEDIUM", expected_sales_change: "0", focus_product_ids: [], estimated_cost: "", currency: "GBP", notes: "", linked_holiday_id: null }; }
function emptyClosureForm(date = dateKey(new Date())): ClosureForm { return { name: "", closure_type: "REST_DAY", start_date: date, end_date: date, notes: "" }; }
function dateKey(value: Date) { return format(value, "yyyy-MM-dd"); }
function differenceInDays(a: string, b: string) { return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000); }
function formatDate(value: string, locale: "zh-CN" | "en-GB") { return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`)); }
function formatLongDate(value: string, locale: "zh-CN" | "en-GB") { return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(`${value}T12:00:00`)); }
function formatCurrency(value: string, currency: string, locale: "zh-CN" | "en-GB") { return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(value)); }
function formatQty(value: string, unit: string, locale: "zh-CN" | "en-GB") { return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(Number(value))}${unit}`; }
