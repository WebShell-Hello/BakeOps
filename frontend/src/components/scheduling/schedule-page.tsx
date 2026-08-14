"use client";

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { enGB, zhCN } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  List as ListIcon,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  type CSSProperties,
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
  bulkDeleteScheduleEntries,
  createScheduleEntry,
  deleteScheduleEntry,
  getActiveScheduleEmployees,
  getScheduleEntries,
  updateScheduleEntry,
  type ScheduleEntry,
  type ScheduleEntryInput,
  type ScheduleEmployeeOption,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type CalendarView = "day" | "week" | "month" | "year";
type DisplayMode = "calendar" | "list";
type ScheduleForm = ScheduleEntryInput;
type ExportRange = { start: string; end: string };

const HOUR_HEIGHT = 52;
const EMPLOYEE_COLOURS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
];

const copy = {
  "zh-CN": {
    title: "排班表",
    description: "记录历史与未来排班；过去班次按上下班时间扣除休息后作为可计薪工时",
    currentPeriods: { day: "本日", week: "本周", month: "本月", year: "本年" },
    thisWeek: "本周",
    previous: "上一时间段",
    next: "下一时间段",
    add: "添加排班",
    export: "导出",
    exportTitle: "导出排班",
    exportDescription: "选择需要导出的排班日期区间",
    exportStart: "开始日期",
    exportEnd: "结束日期",
    exportAction: "导出 CSV",
    exporting: "正在导出...",
    exportRangeError: "结束日期不能早于开始日期",
    exportError: "排班导出失败，请检查日期区间",
    modes: { calendar: "日历模式", list: "列表模式" },
    views: { day: "日", week: "周", month: "月", year: "年" },
    weekdays: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    loading: "正在读取排班...",
    empty: "暂无排班",
    more: (count: number) => `+${count}`,
    createTitle: "添加排班",
    editTitle: "编辑排班",
    employeeName: "姓名",
    selectEmployee: "选择在岗员工",
    inactiveEmployee: "当前员工已非在岗（保留历史排班）",
    deletedEmployee: "已删除员工",
    date: "日期",
    startTime: "上班时间",
    endTime: "下班时间",
    breakMinutes: "休息时间（分钟）",
    actualHours: "实际工时",
    hourlyRate: "时薪",
    dailyWage: "当日工资",
    workContent: "工作内容",
    workPlaceholder: "例如：面包制作、前台服务、清洁整理",
    save: "保存",
    cancel: "取消",
    delete: "删除",
    deleteConfirm: "确定删除这条排班记录吗？",
    selected: (count: number) => `已选择 ${count} 条排班`,
    selectAll: "全选当前列表",
    selectEntry: (name: string) => `选择 ${name} 的排班`,
    deleteSelected: "删除所选",
    deleteSelectedConfirm: (count: number) =>
      `确定删除选中的 ${count} 条排班记录吗？删除后无法恢复。`,
    saved: "排班已保存",
    deleted: "排班已删除",
    loadError: "排班数据加载失败",
    saveError: "排班保存失败，请检查姓名和时间",
    exportEmpty: "当前时间范围没有可导出的排班",
    csvHeaders: ["姓名", "岗位", "日期", "上班时间", "下班时间", "休息分钟", "实际工时", "时薪", "当日工资", "工作内容"],
    actions: "操作",
  },
  "en-GB": {
    title: "Schedule",
    description:
      "Record historical and planned shifts; past shifts become payable hours after breaks",
    currentPeriods: {
      day: "Today",
      week: "This week",
      month: "This month",
      year: "This year",
    },
    thisWeek: "This week",
    previous: "Previous period",
    next: "Next period",
    add: "Add shift",
    export: "Export",
    exportTitle: "Export schedule",
    exportDescription: "Choose the date range to include in the export",
    exportStart: "Start date",
    exportEnd: "End date",
    exportAction: "Export CSV",
    exporting: "Exporting...",
    exportRangeError: "The end date cannot be earlier than the start date",
    exportError: "Unable to export the schedule. Check the date range.",
    modes: { calendar: "Calendar", list: "List" },
    views: { day: "Day", week: "Week", month: "Month", year: "Year" },
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    loading: "Loading schedule...",
    empty: "No shifts",
    more: (count: number) => `+${count}`,
    createTitle: "Add shift",
    editTitle: "Edit shift",
    employeeName: "Name",
    selectEmployee: "Select an active employee",
    inactiveEmployee:
      "Employee is no longer active (historical shift retained)",
    deletedEmployee: "Deleted employee",
    date: "Date",
    startTime: "Start time",
    endTime: "End time",
    breakMinutes: "Break (minutes)",
    actualHours: "Actual hours",
    hourlyRate: "Hourly rate",
    dailyWage: "Daily wage",
    workContent: "Work content",
    workPlaceholder: "For example: baking, counter service or cleaning",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    deleteConfirm: "Delete this schedule entry?",
    selected: (count: number) =>
      `${count} shift${count === 1 ? "" : "s"} selected`,
    selectAll: "Select all shifts in this list",
    selectEntry: (name: string) => `Select ${name}'s shift`,
    deleteSelected: "Delete selected",
    deleteSelectedConfirm: (count: number) =>
      `Delete ${count} selected shift${count === 1 ? "" : "s"}? This cannot be undone.`,
    saved: "Schedule saved",
    deleted: "Schedule entry deleted",
    loadError: "Unable to load the schedule",
    saveError: "Unable to save the shift. Check the name and times.",
    exportEmpty: "There are no shifts to export in this period",
    csvHeaders: ["Name", "Position", "Date", "Start time", "End time", "Break minutes", "Actual hours", "Hourly rate", "Daily wage", "Work content"],
    actions: "Actions",
  },
} as const;

export function SchedulePage() {
  const { locale } = useAppPreferences();
  const { showInfo, showSuccess } = useToast();
  const text = copy[locale];
  const dateLocale = locale === "en-GB" ? enGB : zhCN;
  const [displayMode, setDisplayMode] = useState<DisplayMode>("calendar");
  const [view, setView] = useState<CalendarView>("month");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [employees, setEmployees] = useState<ScheduleEmployeeOption[]>([]);
  const [editingEntry, setEditingEntry] = useState<
    ScheduleEntry | null | undefined
  >(undefined);
  const [form, setForm] = useState<ScheduleForm>(() =>
    emptyScheduleForm(new Date()),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportRange, setExportRange] = useState<ExportRange>(() => {
    const currentRange = calendarRange("month", new Date());
    return {
      start: dateKey(currentRange.start),
      end: dateKey(currentRange.end),
    };
  });
  const range = useMemo(
    () =>
      displayMode === "list"
        ? {
            start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
            end: endOfWeek(selectedDate, { weekStartsOn: 1 }),
          }
        : calendarRange(view, selectedDate),
    [displayMode, selectedDate, view],
  );
  const rangeStart = dateKey(range.start);
  const rangeEnd = dateKey(range.end);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await getScheduleEntries(rangeStart, rangeEnd));
      setSelectedIds([]);
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
    const timer = window.setTimeout(async () => {
      try {
        setEmployees(await getActiveScheduleEmployees());
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : text.loadError,
        );
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [text.loadError]);

  function openCreate(date = selectedDate) {
    const firstActiveEmployee = employees[0];
    setForm(emptyScheduleForm(date, firstActiveEmployee?.id ?? ""));
    setEditingEntry(null);
  }

  function openEdit(entry: ScheduleEntry) {
    setForm({
      employee: entry.employee ?? "",
      work_date: entry.work_date,
      start_time: shortTime(entry.start_time),
      end_time: shortTime(entry.end_time),
      break_minutes: entry.break_minutes,
      work_content: entry.work_content,
    });
    setEditingEntry(entry);
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const input = {
      ...form,
      work_content: form.work_content.trim(),
    };
    try {
      if (editingEntry) await updateScheduleEntry(editingEntry.id, input);
      else await createScheduleEntry(input);
      setEditingEntry(undefined);
      showSuccess(text.saved);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry() {
    if (!editingEntry || !window.confirm(text.deleteConfirm)) return;
    setSaving(true);
    try {
      await deleteScheduleEntry(editingEntry.id);
      setEditingEntry(undefined);
      showSuccess(text.deleted);
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : text.saveError,
      );
    } finally {
      setSaving(false);
    }
  }

  function movePeriod(direction: -1 | 1) {
    const move =
      displayMode === "list"
        ? addWeeks
        : view === "day"
          ? addDays
          : view === "week"
            ? addWeeks
            : view === "month"
              ? addMonths
              : addYears;
    setSelectedDate((current) => move(current, direction));
  }

  function openExport() {
    setExportRange({ start: rangeStart, end: rangeEnd });
    setExportError(null);
    setExportOpen(true);
  }

  async function exportCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (exportRange.end < exportRange.start) {
      setExportError(text.exportRangeError);
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      const exportEntries = await getScheduleEntries(
        exportRange.start,
        exportRange.end,
      );
      if (!exportEntries.length) {
        showInfo(text.exportEmpty);
        return;
      }
      downloadScheduleCsv(
        exportEntries,
        text.csvHeaders,
        exportRange.start,
        exportRange.end,
      );
      setExportOpen(false);
    } catch (downloadError) {
      setExportError(
        downloadError instanceof Error
          ? downloadError.message
          : text.exportError,
      );
    } finally {
      setExporting(false);
    }
  }

  async function removeListEntries(ids: string[], confirmation: string) {
    if (!ids.length || !window.confirm(confirmation)) return;
    setDeleting(true);
    setError(null);
    try {
      if (ids.length === 1) await deleteScheduleEntry(ids[0]);
      else await bulkDeleteScheduleEntries(ids);
      showSuccess(text.deleted);
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : text.saveError,
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <PageBreadcrumb fallback={{ zh: text.title, en: text.title }} />
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              {text.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openExport}>
              <Download className="size-4" />
              {text.export}
            </Button>
            <Button variant="outline" onClick={() => openCreate()}>
              <Plus className="size-4" />
              {text.add}
            </Button>
          </div>
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

          <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label={text.previous}
                onClick={() => movePeriod(-1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedDate(new Date())}
              >
                {displayMode === "list"
                  ? text.thisWeek
                  : text.currentPeriods[view]}
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={text.next}
                onClick={() => movePeriod(1)}
              >
                <ChevronRight className="size-4" />
              </Button>
              <h2 className="ml-2 text-lg font-semibold">
                {rangeTitle(
                  displayMode === "list" ? "week" : view,
                  selectedDate,
                  dateLocale,
                  locale,
                )}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {displayMode === "calendar" ? (
                <div className="inline-flex w-fit rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1">
                  {(["day", "week", "month", "year"] as CalendarView[]).map(
                    (item) => (
                      <button
                        key={item}
                        type="button"
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-sm transition-colors",
                          view === item
                            ? "bg-[var(--card)] font-medium shadow-sm"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]",
                        )}
                        onClick={() => setView(item)}
                      >
                        {text.views[item]}
                      </button>
                    ),
                  )}
                </div>
              ) : null}
              <div className="inline-flex w-fit rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1">
                {(["calendar", "list"] as DisplayMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                      displayMode === mode
                        ? "bg-[var(--card)] font-medium shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]",
                    )}
                    onClick={() => setDisplayMode(mode)}
                  >
                    {mode === "calendar" ? (
                      <CalendarDays className="size-3.5" />
                    ) : (
                      <ListIcon className="size-3.5" />
                    )}
                    {text.modes[mode]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative">
            {loading ? (
              <div className="absolute inset-0 z-20 grid min-h-80 place-items-center bg-[var(--card)]/80 text-sm text-[var(--muted)]">
                {text.loading}
              </div>
            ) : null}
            {displayMode === "list" ? (
              <ScheduleList
                entries={entries}
                text={text}
                dateLocale={dateLocale}
                selectedIds={selectedIds}
                deleting={deleting}
                onToggleSelection={(id) =>
                  setSelectedIds((current) =>
                    current.includes(id)
                      ? current.filter((item) => item !== id)
                      : [...current, id],
                  )
                }
                onToggleAll={() =>
                  setSelectedIds(
                    selectedIds.length === entries.length
                      ? []
                      : entries.map((entry) => entry.id),
                  )
                }
                onDelete={(entry) =>
                  void removeListEntries(
                    [entry.id],
                    text.deleteConfirm,
                  )
                }
                onDeleteSelected={() =>
                  void removeListEntries(
                    selectedIds,
                    text.deleteSelectedConfirm(selectedIds.length),
                  )
                }
                onEdit={openEdit}
              />
            ) : null}
            {displayMode === "calendar" && view === "month" ? (
              <MonthCalendar
                date={selectedDate}
                entries={entries}
                weekdays={text.weekdays}
                more={text.more}
                onCreate={openCreate}
                onEdit={openEdit}
              />
            ) : null}
            {displayMode === "calendar" && view === "year" ? (
              <YearCalendar
                date={selectedDate}
                entries={entries}
                weekdays={text.weekdays}
                dateLocale={dateLocale}
                onCreate={openCreate}
                onEdit={openEdit}
              />
            ) : null}
            {displayMode === "calendar" && view === "week" ? (
              <WeekCalendar
                date={selectedDate}
                entries={entries}
                empty={text.empty}
                dateLocale={dateLocale}
                onCreate={openCreate}
                onEdit={openEdit}
              />
            ) : null}
            {displayMode === "calendar" && view === "day" ? (
              <TimeCalendar
                date={selectedDate}
                entries={entries}
                empty={text.empty}
                onCreate={openCreate}
                onEdit={openEdit}
              />
            ) : null}
          </div>
        </Card>
      </main>

      {exportOpen ? (
        <ExportDialog
          text={text}
          value={exportRange}
          exporting={exporting}
          error={exportError}
          onChange={setExportRange}
          onClose={() => setExportOpen(false)}
          onSubmit={exportCsv}
        />
      ) : null}

      {editingEntry !== undefined ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editingEntry ? text.editTitle : text.createTitle}
        >
          <button
            type="button"
            aria-label={text.cancel}
            className="absolute inset-0"
            onClick={() => setEditingEntry(undefined)}
          />
          <div className="relative z-10 w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary-soft)]">
                  <CalendarDays className="size-4" />
                </span>
                <h2 className="text-lg font-semibold">
                  {editingEntry ? text.editTitle : text.createTitle}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label={text.cancel}
                onClick={() => setEditingEntry(undefined)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <form className="space-y-4 p-5" onSubmit={saveEntry}>
              <Field label={text.employeeName}>
                <select
                  required
                  value={form.employee}
                  className={inputClass}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      employee: event.target.value,
                    }))
                  }
                >
                  <option value="">{text.selectEmployee}</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} · {employee.position}
                    </option>
                  ))}
                  {editingEntry?.employee &&
                  !employees.some(
                    (employee) => employee.id === editingEntry.employee,
                  ) ? (
                    <option value={editingEntry.employee}>
                      {editingEntry.employee_name} · {text.inactiveEmployee}
                    </option>
                  ) : null}
                </select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label={text.date}>
                  <input
                    required
                    type="date"
                    value={form.work_date}
                    className={inputClass}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        work_date: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label={text.startTime}>
                  <input
                    required
                    type="time"
                    value={form.start_time}
                    className={inputClass}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        start_time: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label={text.endTime}>
                  <input
                    required
                    type="time"
                    value={form.end_time}
                    className={inputClass}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        end_time: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label={text.breakMinutes}>
                  <input
                    required
                    min={0}
                    step={5}
                    type="number"
                    value={form.break_minutes}
                    className={inputClass}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        break_minutes: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
              </div>
              <Field label={text.workContent}>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={form.work_content}
                  placeholder={text.workPlaceholder}
                  className={`${inputClass} h-auto min-h-24 py-2`}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      work_content: event.target.value,
                    }))
                  }
                />
              </Field>
              <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
                {editingEntry ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-rose-500"
                    disabled={saving}
                    onClick={() => void removeEntry()}
                  >
                    <Trash2 className="size-4" />
                    {text.delete}
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingEntry(undefined)}
                  >
                    {text.cancel}
                  </Button>
                  <Button type="submit" variant="outline" disabled={saving}>
                    {text.save}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}

function ExportDialog({
  text,
  value,
  exporting,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  text: (typeof copy)["zh-CN"] | (typeof copy)["en-GB"];
  value: ExportRange;
  exporting: boolean;
  error: string | null;
  onChange: (value: ExportRange) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={text.exportTitle}
    >
      <button
        type="button"
        aria-label={text.cancel}
        className="absolute inset-0"
        disabled={exporting}
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
              <Download className="size-4" />
            </span>
            <div>
              <h2 className="font-semibold">{text.exportTitle}</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {text.exportDescription}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={text.cancel}
            disabled={exporting}
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </header>
        <form className="space-y-4 p-5" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={text.exportStart}>
              <input
                required
                type="date"
                className={inputClass}
                value={value.start}
                max={value.end || undefined}
                onChange={(event) =>
                  onChange({ ...value, start: event.target.value })
                }
              />
            </Field>
            <Field label={text.exportEnd}>
              <input
                required
                type="date"
                className={inputClass}
                value={value.end}
                min={value.start || undefined}
                onChange={(event) =>
                  onChange({ ...value, end: event.target.value })
                }
              />
            </Field>
          </div>
          {error ? (
            <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-rose-600">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={exporting}
              onClick={onClose}
            >
              {text.cancel}
            </Button>
            <Button type="submit" variant="outline" disabled={exporting}>
              <Download className="size-4" />
              {exporting ? text.exporting : text.exportAction}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScheduleList({
  entries,
  text,
  dateLocale,
  selectedIds,
  deleting,
  onToggleSelection,
  onToggleAll,
  onDelete,
  onDeleteSelected,
  onEdit,
}: {
  entries: ScheduleEntry[];
  text: (typeof copy)["zh-CN"] | (typeof copy)["en-GB"];
  dateLocale: typeof enGB;
  selectedIds: string[];
  deleting: boolean;
  onToggleSelection: (id: string) => void;
  onToggleAll: () => void;
  onDelete: (entry: ScheduleEntry) => void;
  onDeleteSelected: () => void;
  onEdit: (entry: ScheduleEntry) => void;
}) {
  const allSelected =
    entries.length > 0 && entries.every((entry) => selectedIds.includes(entry.id));
  return (
    <div>
      <div className="flex min-h-13 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2">
        <span className="text-sm text-[var(--muted)]">
          {selectedIds.length ? text.selected(selectedIds.length) : ""}
        </span>
        <Button
          variant="outline"
          className="text-rose-600"
          disabled={!selectedIds.length || deleting}
          onClick={onDeleteSelected}
        >
          <Trash2 className="size-4" />
          {text.deleteSelected}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] border-collapse text-sm">
        <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
          <tr>
            <th className="w-12 px-4 py-3">
              <input
                type="checkbox"
                aria-label={text.selectAll}
                checked={allSelected}
                onChange={onToggleAll}
              />
            </th>
            <th className="w-40 px-4 py-3">{text.date}</th>
            <th className="w-44 px-4 py-3">{text.employeeName}</th>
            <th className="w-40 px-4 py-3">{text.startTime}</th>
            <th className="w-40 px-4 py-3">{text.endTime}</th>
            <th className="w-32 px-4 py-3">{text.breakMinutes}</th>
            <th className="w-28 px-4 py-3">{text.actualHours}</th>
            <th className="w-24 px-4 py-3">{text.hourlyRate}</th>
            <th className="w-28 px-4 py-3">{text.dailyWage}</th>
            <th className="px-4 py-3">{text.workContent}</th>
            <th className="w-28 px-4 py-3 text-right">{text.actions}</th>
          </tr>
        </thead>
        <tbody>
          {entries.length ? (
            entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-muted)]"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={text.selectEntry(entry.employee_name)}
                    checked={selectedIds.includes(entry.id)}
                    onChange={() => onToggleSelection(entry.id)}
                  />
                </td>
                <td className="px-4 py-3 font-medium">
                  {format(
                    new Date(`${entry.work_date}T12:00:00`),
                    "EEE, d MMM",
                    { locale: dateLocale },
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{
                        backgroundColor: employeeColour(entry.employee_name),
                      }}
                    />
                    {entry.employee_name}
                    {entry.employee_is_deleted ? <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600">{text.deletedEmployee}</span> : null}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {shortTime(entry.start_time)}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {shortTime(entry.end_time)}
                </td>
                <td className="px-4 py-3 tabular-nums">{entry.break_minutes}</td>
                <td className="px-4 py-3 tabular-nums">{entry.actual_hours}h</td>
                <td className="px-4 py-3 tabular-nums">
                  {entry.hourly_rate ? `£${entry.hourly_rate}` : "—"}
                </td>
                <td className="px-4 py-3 font-medium tabular-nums">
                  {entry.daily_wage ? `£${entry.daily_wage}` : "—"}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {entry.work_content || "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`${text.editTitle}: ${entry.employee_name}`}
                      onClick={() => onEdit(entry)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-rose-600"
                      disabled={deleting}
                      aria-label={`${text.delete}: ${entry.employee_name}`}
                      onClick={() => onDelete(entry)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={11}
                className="px-4 py-16 text-center text-[var(--muted)]"
              >
                {text.empty}
              </td>
            </tr>
          )}
        </tbody>
        </table>
      </div>
    </div>
  );
}

function MonthCalendar({
  date,
  entries,
  weekdays,
  more,
  onCreate,
  onEdit,
}: {
  date: Date;
  entries: ScheduleEntry[];
  weekdays: readonly string[];
  more: (count: number) => string;
  onCreate: (date: Date) => void;
  onEdit: (entry: ScheduleEntry) => void;
}) {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  return (
    <div className="min-w-[760px] overflow-x-auto">
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-muted)]">
        {weekdays.map((day) => (
          <div
            key={day}
            className="px-3 py-2 text-center text-xs font-medium text-[var(--muted)]"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEntries = entriesForDate(entries, day);
          return (
            <div
              key={dateKey(day)}
              className={cn(
                "min-h-28 border-r border-b border-[var(--border)] p-2",
                !isSameMonth(day, date) &&
                  "bg-[var(--surface-muted)]/45 text-[var(--muted)]",
              )}
            >
              <button
                type="button"
                className={cn(
                  "mb-2 grid size-7 place-items-center rounded-full text-xs hover:bg-[var(--surface-muted)]",
                  isToday(day) &&
                    "bg-[var(--primary-soft)] font-semibold text-[var(--primary)] ring-1 ring-inset ring-[var(--primary-border)]",
                )}
                onClick={() => onCreate(day)}
              >
                {format(day, "d")}
              </button>
              <div className="flex flex-wrap gap-1">
                {dayEntries.slice(0, 6).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    title={`${entry.employee_name} ${shortTime(entry.start_time)}–${shortTime(entry.end_time)}`}
                    className="grid size-7 place-items-center rounded-full text-[10px] font-semibold text-white shadow-sm"
                    style={{
                      backgroundColor: employeeColour(entry.employee_name),
                    }}
                    onClick={() => onEdit(entry)}
                  >
                    {entry.employee_name.slice(0, 1).toUpperCase()}
                  </button>
                ))}
                {dayEntries.length > 6 ? (
                  <span className="grid size-7 place-items-center rounded-full bg-[var(--surface-muted)] text-[10px] text-[var(--muted)]">
                    {more(dayEntries.length - 6)}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearCalendar({
  date,
  entries,
  weekdays,
  dateLocale,
  onCreate,
  onEdit,
}: {
  date: Date;
  entries: ScheduleEntry[];
  weekdays: readonly string[];
  dateLocale: typeof enGB;
  onCreate: (date: Date) => void;
  onEdit: (entry: ScheduleEntry) => void;
}) {
  const months = eachMonthOfInterval({
    start: startOfYear(date),
    end: endOfYear(date),
  });
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {months.map((month) => {
        const days = eachDayOfInterval({
          start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
          end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
        });
        return (
          <section
            key={dateKey(month)}
            className="rounded-xl border border-[var(--border)] p-3"
          >
            <h3 className="mb-2 text-sm font-semibold">
              {format(month, "LLLL", { locale: dateLocale })}
            </h3>
            <div className="grid grid-cols-7">
              {weekdays.map((weekday) => (
                <span
                  key={weekday}
                  className="pb-1 text-center text-[9px] text-[var(--muted)]"
                >
                  {weekday.slice(-1)}
                </span>
              ))}
              {days.map((day) => {
                const dayEntries = entriesForDate(entries, day);
                return (
                  <button
                    key={dateKey(day)}
                    type="button"
                    className={cn(
                      "flex aspect-square min-h-8 flex-col items-center justify-center rounded-md text-[10px] hover:bg-[var(--surface-muted)]",
                      !isSameMonth(day, month) && "opacity-25",
                      isToday(day) && "ring-1 ring-[var(--primary-border)]",
                    )}
                    onClick={() =>
                      dayEntries[0] ? onEdit(dayEntries[0]) : onCreate(day)
                    }
                  >
                    <span>{format(day, "d")}</span>
                    <span className="mt-0.5 flex h-1.5 gap-0.5">
                      {dayEntries.slice(0, 4).map((entry) => (
                        <span
                          key={entry.id}
                          className="size-1.5 rounded-full"
                          style={{
                            backgroundColor: employeeColour(
                              entry.employee_name,
                            ),
                          }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function WeekCalendar({
  date,
  entries,
  empty,
  dateLocale,
  onCreate,
  onEdit,
}: {
  date: Date;
  entries: ScheduleEntry[];
  empty: string;
  dateLocale: typeof enGB;
  onCreate: (date: Date) => void;
  onEdit: (entry: ScheduleEntry) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  });

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[760px] grid-cols-7">
        {days.map((day) => {
          const dayEntries = entriesForDate(entries, day);
          return (
            <section
              key={dateKey(day)}
              className="min-h-72 border-r border-[var(--border)] last:border-r-0"
            >
              <button
                type="button"
                className={cn(
                  "w-full border-b border-[var(--border)] bg-[var(--surface-muted)] px-2 py-3 text-center text-xs font-medium hover:bg-[var(--primary-soft)]",
                  isToday(day) &&
                    "border-t-2 border-t-[var(--primary)] bg-[var(--primary-soft)] font-semibold text-[var(--primary)]",
                )}
                onClick={() => onCreate(day)}
              >
                {format(day, "EEE d", { locale: dateLocale })}
              </button>
              <div className="flex flex-col gap-2 p-2">
                {dayEntries.length ? (
                  dayEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className="w-full truncate rounded-lg border-l-4 bg-[var(--surface-muted)] px-2.5 py-2 text-left text-sm font-medium hover:bg-[var(--primary-soft)]"
                      style={{
                        borderLeftColor: employeeColour(entry.employee_name),
                      }}
                      title={entry.employee_name}
                      onClick={() => onEdit(entry)}
                    >
                      {entry.employee_name}
                    </button>
                  ))
                ) : (
                  <span className="py-4 text-center text-xs text-[var(--muted)]">
                    {empty}
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TimeCalendar({
  date,
  entries,
  empty,
  onCreate,
  onEdit,
}: {
  date: Date;
  entries: ScheduleEntry[];
  empty: string;
  onCreate: (date: Date) => void;
  onEdit: (entry: ScheduleEntry) => void;
}) {
  const employees = [
    ...new Set(
      entriesForDate(entries, date).map((entry) => entry.employee_name),
    ),
  ];
  const columns = employees.length
    ? employees.map((employee) => ({
        key: employee,
        label: employee,
        date,
        entries: entriesForDate(entries, date).filter(
          (entry) => entry.employee_name === employee,
        ),
      }))
    : [{ key: "empty", label: empty, date, entries: [] }];
  const gridStyle = { "--schedule-columns": columns.length } as CSSProperties;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[780px]" style={gridStyle}>
        <div
          className="grid border-b border-[var(--border)] bg-[var(--surface-muted)]"
          style={{
            gridTemplateColumns: `64px repeat(${columns.length}, minmax(130px, 1fr))`,
          }}
        >
          <div />
          {columns.map((column) => (
            <button
              key={column.key}
              type="button"
              className="border-l border-[var(--border)] px-2 py-3 text-center text-xs font-medium hover:bg-[var(--card)]"
              onClick={() => onCreate(column.date)}
            >
              {column.label}
            </button>
          ))}
        </div>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `64px repeat(${columns.length}, minmax(130px, 1fr))`,
          }}
        >
          <div
            className="relative border-r border-[var(--border)]"
            style={{ height: 24 * HOUR_HEIGHT }}
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <span
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-[var(--muted)]"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {columns.map((column) => (
            <div
              key={column.key}
              className="relative cursor-crosshair border-r border-[var(--border)]"
              style={{
                height: 24 * HOUR_HEIGHT,
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_HEIGHT - 1}px, var(--border) ${HOUR_HEIGHT}px)`,
              }}
              onClick={() => onCreate(column.date)}
            >
              {column.entries.map((entry, index) => {
                const position = shiftPosition(entry);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className="absolute z-10 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-[11px] shadow-sm"
                    style={{
                      top: position.top,
                      height: position.height,
                      left: 4 + (index % 3) * 5,
                      right: 4,
                      borderLeftColor: employeeColour(entry.employee_name),
                      backgroundColor: `${employeeColour(entry.employee_name)}30`,
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(entry);
                    }}
                  >
                    <span className="block truncate font-semibold">
                      {entry.employee_name}
                    </span>
                    <span className="block truncate">
                      {shortTime(entry.start_time)}–{shortTime(entry.end_time)}
                    </span>
                    {position.height > 48 && entry.work_content ? (
                      <span className="mt-0.5 block truncate text-[var(--muted)]">
                        {entry.work_content}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function calendarRange(view: CalendarView, date: Date) {
  if (view === "day") return { start: date, end: date };
  if (view === "week")
    return {
      start: startOfWeek(date, { weekStartsOn: 1 }),
      end: endOfWeek(date, { weekStartsOn: 1 }),
    };
  if (view === "month")
    return {
      start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }),
    };
  return { start: startOfYear(date), end: endOfYear(date) };
}

function rangeTitle(
  view: CalendarView,
  date: Date,
  dateLocale: typeof enGB,
  locale: "zh-CN" | "en-GB",
) {
  if (view === "day")
    return format(
      date,
      locale === "en-GB" ? "EEEE, d MMMM yyyy" : "yyyy年M月d日 EEEE",
      { locale: dateLocale },
    );
  if (view === "week") {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(date, { weekStartsOn: 1 });
    return `${format(start, "d MMM", { locale: dateLocale })} – ${format(end, "d MMM yyyy", { locale: dateLocale })}`;
  }
  if (view === "month")
    return format(date, locale === "en-GB" ? "MMMM yyyy" : "yyyy年M月", {
      locale: dateLocale,
    });
  return format(date, "yyyy");
}

function emptyScheduleForm(date: Date, employee = ""): ScheduleForm {
  return {
    employee,
    work_date: dateKey(date),
    start_time: "09:00",
    end_time: "17:00",
    break_minutes: 30,
    work_content: "",
  };
}
function entriesForDate(entries: ScheduleEntry[], date: Date) {
  const key = dateKey(date);
  return entries.filter((entry) => entry.work_date === key);
}
function dateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}
function shortTime(time: string) {
  return time.slice(0, 5);
}
function minutes(time: string) {
  const [hours, minute] = shortTime(time).split(":").map(Number);
  return hours * 60 + minute;
}
function shiftPosition(entry: ScheduleEntry) {
  const start = minutes(entry.start_time);
  const end = minutes(entry.end_time);
  return {
    top: (start / 60) * HOUR_HEIGHT,
    height: Math.max(((end - start) / 60) * HOUR_HEIGHT, 28),
  };
}
function employeeColour(name: string) {
  let hash = 0;
  for (const character of name)
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return EMPLOYEE_COLOURS[Math.abs(hash) % EMPLOYEE_COLOURS.length];
}
function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadScheduleCsv(
  entries: ScheduleEntry[],
  headers: readonly string[],
  rangeStart: string,
  rangeEnd: string,
) {
  const rows = [
    [...headers],
    ...entries.map((entry) => [
      entry.employee_name,
      entry.employee_position,
      entry.work_date,
      shortTime(entry.start_time),
      shortTime(entry.end_time),
      String(entry.break_minutes),
      entry.actual_hours,
      entry.hourly_rate ?? "",
      entry.daily_wage ?? "",
      entry.work_content,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `bakeops-schedule-${rangeStart}-${rangeEnd}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const inputClass =
  "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)]";
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
