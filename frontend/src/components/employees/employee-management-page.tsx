"use client";

import {
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
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
  DataPagination,
  useDataPagination,
} from "@/components/ui/data-pagination";
import {
  bulkDeleteEmployees,
  bulkRestoreEmployees,
  createEmployee,
  deleteEmployee,
  getEmployeeScheduleHistory,
  getEmployees,
  restoreEmployee,
  updateEmployee,
  type Employee,
  type EmployeeInput,
  type EmployeeScheduleHistory,
  type EmployeeStatus,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const emptyForm: EmployeeInput = {
  employee_number: "",
  name: "",
  gender: "UNSPECIFIED",
  date_of_birth: "2001-05-03",
  hire_date: "2026-08-14",
  departure_date: null,
  position: "",
  hourly_rate: "0.00",
  employment_type: "PART_TIME",
  email: "",
  status: "ACTIVE",
};

const copy = {
  "zh-CN": {
    title: "员工",
    description: "管理员工档案、职位、薪酬类型和在岗状态",
    add: "新增员工",
    search: "查找姓名、员工号、邮箱或职位",
    employeeNumber: "员工号",
    name: "姓名",
    gender: "性别",
    birthDate: "出生日期",
    hireDate: "入职日期",
    departureDate: "离职日期",
    position: "职位",
    hourlyRate: "时薪",
    employmentType: "类型",
    email: "邮箱",
    status: "状态",
    actions: "操作",
    genders: { UNSPECIFIED: "未设置", FEMALE: "女", MALE: "男", OTHER: "其他" },
    types: { FULL_TIME: "全职", PART_TIME: "兼职" },
    statuses: {
      ACTIVE: "在岗",
      ON_LEAVE: "休假",
      DEPARTED: "离职",
      SUSPENDED: "停职",
    },
    loading: "正在读取员工档案...",
    empty: "没有符合条件的员工",
    createTitle: "新增员工",
    editTitle: "编辑员工",
    edit: "编辑员工",
    save: "保存",
    cancel: "取消",
    saved: "员工信息已保存",
    loadError: "员工数据加载失败",
    saveError: "员工信息保存失败，请检查填写内容",
    current: "当前员工",
    deletedList: "已删除",
    selected: (count: number) => `已选择 ${count} 名员工`,
    delete: "删除",
    restore: "恢复",
    deleteSelected: "删除所选",
    restoreSelected: "恢复所选",
    deleteConfirm: (count: number) =>
      `确定删除选中的 ${count} 名员工吗？删除后可从“已删除”列表恢复。`,
    deleteOneConfirm: (name: string) =>
      `确定删除员工“${name}”吗？删除后可从“已删除”列表恢复。`,
    deleted: "员工已移入已删除列表",
    restored: "员工已恢复",
    operationError: "操作失败，请稍后重试",
    historyTitle: "历史排班",
    deletedEmployee: "已删除员工",
    historyLoading: "正在读取历史排班...",
    historyEmpty: "该员工暂无历史排班",
    shiftCount: "历史班次",
    totalHours: "累计工时",
    totalWages: "累计工资",
    shiftDate: "日期",
    shiftTime: "班次时间",
    breakMinutes: "休息",
    actualHours: "实际工时",
    dailyWage: "当日工资",
    workContent: "工作内容",
  },
  "en-GB": {
    title: "Staff",
    description:
      "Manage employee records, roles, pay type and employment status",
    add: "Add employee",
    search: "Find by name, employee number, email or position",
    employeeNumber: "Employee no.",
    name: "Name",
    gender: "Gender",
    birthDate: "Date of birth",
    hireDate: "Hire date",
    departureDate: "Departure date",
    position: "Position",
    hourlyRate: "Hourly rate",
    employmentType: "Type",
    email: "Email",
    status: "Status",
    actions: "Actions",
    genders: {
      UNSPECIFIED: "Not set",
      FEMALE: "Female",
      MALE: "Male",
      OTHER: "Other",
    },
    types: { FULL_TIME: "Full time", PART_TIME: "Part time" },
    statuses: {
      ACTIVE: "Active",
      ON_LEAVE: "On leave",
      DEPARTED: "Departed",
      SUSPENDED: "Suspended",
    },
    loading: "Loading employee records...",
    empty: "No matching employees",
    createTitle: "Add employee",
    editTitle: "Edit employee",
    edit: "Edit employee",
    save: "Save",
    cancel: "Cancel",
    saved: "Employee details saved",
    loadError: "Unable to load employees",
    saveError: "Unable to save the employee. Check the details and try again.",
    current: "Current staff",
    deletedList: "Deleted",
    selected: (count: number) =>
      `${count} employee${count === 1 ? "" : "s"} selected`,
    delete: "Delete",
    restore: "Restore",
    deleteSelected: "Delete selected",
    restoreSelected: "Restore selected",
    deleteConfirm: (count: number) =>
      `Delete ${count} selected employee${count === 1 ? "" : "s"}? They can be restored from the Deleted list.`,
    deleteOneConfirm: (name: string) =>
      `Delete “${name}”? This employee can be restored from the Deleted list.`,
    deleted: "Employee moved to the Deleted list",
    restored: "Employee restored",
    operationError: "The operation failed. Please try again.",
    historyTitle: "Shift History",
    deletedEmployee: "Deleted employee",
    historyLoading: "Loading shift history...",
    historyEmpty: "This employee has no historical shifts",
    shiftCount: "Historical shifts",
    totalHours: "Total hours",
    totalWages: "Total wages",
    shiftDate: "Date",
    shiftTime: "Shift",
    breakMinutes: "Break",
    actualHours: "Actual hours",
    dailyWage: "Daily wage",
    workContent: "Work content",
  },
} as const;

export function EmployeeManagementPage() {
  const { locale } = useAppPreferences();
  const { showSuccess } = useToast();
  const text = copy[locale];
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Employee | null | undefined>(undefined);
  const [form, setForm] = useState<EmployeeInput>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [operating, setOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null);
  const [history, setHistory] = useState<EmployeeScheduleHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEmployees(await getEmployees("", "", showDeleted));
      setSelectedIds([]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [showDeleted, text.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filteredEmployees = useMemo(() => {
    const term = query.trim().toLocaleLowerCase(locale);
    if (!term) return employees;
    return employees.filter((employee) =>
      `${employee.employee_number} ${employee.name} ${employee.email} ${employee.position}`
        .toLocaleLowerCase(locale)
        .includes(term),
    );
  }, [employees, locale, query]);
  const employeePagination = useDataPagination(filteredEmployees);

  const allSelected =
    employeePagination.pageItems.length > 0 &&
    employeePagination.pageItems.every((employee) =>
      selectedIds.includes(employee.id),
    );

  async function openCreate() {
    let deletedEmployees: Employee[] = [];
    try {
      deletedEmployees = await getEmployees("", "", true);
    } catch {
      // The employee number remains editable if the deleted list is temporarily unavailable.
    }
    const nextNumber = String(
      Math.max(
        110000,
        ...[...employees, ...deletedEmployees].map(
          (employee) => Number(employee.employee_number) || 0,
        ),
      ) + 1,
    );
    setForm({ ...emptyForm, employee_number: nextNumber });
    setEditor(null);
  }

  async function openHistory(employee: Employee) {
    setHistoryEmployee(employee);
    setHistory(null);
    setHistoryLoading(true);
    try {
      setHistory(await getEmployeeScheduleHistory(employee.id));
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : text.loadError);
    } finally {
      setHistoryLoading(false);
    }
  }

  function openEdit(employee: Employee) {
    setForm({
      employee_number: employee.employee_number,
      name: employee.name,
      gender: employee.gender,
      date_of_birth: employee.date_of_birth,
      hire_date: employee.hire_date,
      departure_date: employee.departure_date,
      position: employee.position,
      hourly_rate: employee.hourly_rate,
      employment_type: employee.employment_type,
      email: employee.email,
      status: employee.status,
    });
    setEditor(employee);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const input = {
      ...form,
      employee_number: form.employee_number.trim(),
      name: form.name.trim(),
      position: form.position.trim(),
      email: form.email.trim().toLocaleLowerCase(),
    };
    try {
      if (editor) await updateEmployee(editor.id, input);
      else await createEmployee(input);
      setEditor(undefined);
      showSuccess(text.saved);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function removeEmployees(ids: string[], confirmation: string) {
    if (!ids.length || !window.confirm(confirmation)) return;
    setOperating(true);
    setError(null);
    try {
      if (ids.length === 1) await deleteEmployee(ids[0]);
      else await bulkDeleteEmployees(ids);
      showSuccess(text.deleted);
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : text.operationError,
      );
    } finally {
      setOperating(false);
    }
  }

  async function restoreEmployees(ids: string[]) {
    if (!ids.length) return;
    setOperating(true);
    setError(null);
    try {
      if (ids.length === 1) await restoreEmployee(ids[0]);
      else await bulkRestoreEmployees(ids);
      showSuccess(text.restored);
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : text.operationError,
      );
    } finally {
      setOperating(false);
    }
  }

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <PageBreadcrumb fallback={{ zh: text.title, en: text.title }} />
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              {text.description}
            </p>
          </div>
          {!showDeleted ? (
            <Button variant="outline" onClick={() => void openCreate()}>
              <Plus className="size-4" />
              {text.add}
            </Button>
          ) : null}
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
            <div className="flex shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1">
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  !showDeleted
                    ? "bg-[var(--card)] font-medium shadow-sm"
                    : "text-[var(--muted)]",
                )}
                onClick={() => {
                  setShowDeleted(false);
                  employeePagination.resetPage();
                }}
              >
                {text.current}
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  showDeleted
                    ? "bg-[var(--card)] font-medium shadow-sm"
                    : "text-[var(--muted)]",
                )}
                onClick={() => {
                  setShowDeleted(true);
                  employeePagination.resetPage();
                }}
              >
                {text.deletedList}
              </button>
            </div>
            <label className="relative block w-full max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                className={`${inputClass} pl-9`}
                value={query}
                placeholder={text.search}
                onChange={(event) => {
                  setQuery(event.target.value);
                  employeePagination.resetPage();
                }}
              />
            </label>
            {selectedIds.length ? (
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm text-[var(--muted)]">
                  {text.selected(selectedIds.length)}
                </span>
                <Button
                  variant="outline"
                  className={showDeleted ? "" : "text-rose-600"}
                  disabled={operating}
                  onClick={() =>
                    showDeleted
                      ? void restoreEmployees(selectedIds)
                      : void removeEmployees(
                          selectedIds,
                          text.deleteConfirm(selectedIds.length),
                        )
                  }
                >
                  {showDeleted ? (
                    <RotateCcw className="size-4" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  {showDeleted ? text.restoreSelected : text.deleteSelected}
                </Button>
              </div>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1380px] border-collapse text-sm">
              <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={text.selected(
                        employeePagination.pageItems.length,
                      )}
                      checked={allSelected}
                      onChange={() =>
                        setSelectedIds((current) => {
                          const pageIds = employeePagination.pageItems.map(
                            (employee) => employee.id,
                          );
                          return allSelected
                            ? current.filter((id) => !pageIds.includes(id))
                            : [...new Set([...current, ...pageIds])];
                        })
                      }
                    />
                  </th>
                  <th className="px-4 py-3">{text.employeeNumber}</th>
                  <th className="px-4 py-3">{text.name}</th>
                  <th className="px-4 py-3">{text.gender}</th>
                  <th className="px-4 py-3">{text.birthDate}</th>
                  <th className="px-4 py-3">{text.hireDate}</th>
                  <th className="px-4 py-3">{text.departureDate}</th>
                  <th className="px-4 py-3">{text.position}</th>
                  <th className="px-4 py-3">{text.hourlyRate}</th>
                  <th className="px-4 py-3">{text.employmentType}</th>
                  <th className="px-4 py-3">{text.email}</th>
                  <th className="px-4 py-3">{text.status}</th>
                  <th className="px-4 py-3 text-right">{text.actions}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={13}
                      className="px-4 py-16 text-center text-[var(--muted)]"
                    >
                      {text.loading}
                    </td>
                  </tr>
                ) : filteredEmployees.length ? (
                  employeePagination.pageItems.map((employee) => (
                    <tr
                      key={employee.id}
                      tabIndex={0}
                      className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)] focus:outline-none"
                      onClick={() => void openHistory(employee)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void openHistory(employee);
                        }
                      }}
                    >
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`${text.selected(1)}: ${employee.name}`}
                          checked={selectedIds.includes(employee.id)}
                          onChange={() =>
                            setSelectedIds((current) =>
                              current.includes(employee.id)
                                ? current.filter((id) => id !== employee.id)
                                : [...current, employee.id],
                            )
                          }
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {employee.employee_number}
                      </td>
                      <td className="px-4 py-3 font-medium">{employee.name}</td>
                      <td className="px-4 py-3">
                        {text.genders[employee.gender]}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {employee.date_of_birth}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {employee.hire_date}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {employee.departure_date ?? "—"}
                      </td>
                      <td className="px-4 py-3">{employee.position}</td>
                      <td className="px-4 py-3 tabular-nums">
                        £{employee.hourly_rate}
                      </td>
                      <td className="px-4 py-3">
                        {text.types[employee.employment_type]}
                      </td>
                      <td className="px-4 py-3">{employee.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                            statusClass(employee.status),
                          )}
                        >
                          {text.statuses[employee.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                        {showDeleted ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={operating}
                            aria-label={`${text.restore}: ${employee.name}`}
                            onClick={() => void restoreEmployees([employee.id])}
                          >
                            <RotateCcw className="size-3.5" />
                          </Button>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`${text.edit}: ${employee.name}`}
                              onClick={() => openEdit(employee)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-rose-600"
                              disabled={operating}
                              aria-label={`${text.delete}: ${employee.name}`}
                              onClick={() =>
                                void removeEmployees(
                                  [employee.id],
                                  text.deleteOneConfirm(employee.name),
                                )
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={13}
                      className="px-4 py-16 text-center text-[var(--muted)]"
                    >
                      {text.empty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <DataPagination
            locale={locale}
            page={employeePagination.page}
            pageSize={employeePagination.pageSize}
            pageCount={employeePagination.pageCount}
            totalItems={filteredEmployees.length}
            onPageChange={employeePagination.setPage}
            onPageSizeChange={employeePagination.setPageSize}
          />
        </Card>
      </main>

      {editor !== undefined ? (
        <EmployeeModal
          title={editor ? text.editTitle : text.createTitle}
          text={text}
          form={form}
          saving={saving}
          onChange={setForm}
          onClose={() => setEditor(undefined)}
          onSubmit={save}
        />
      ) : null}
      {historyEmployee ? (
        <EmployeeHistoryDrawer
          employee={historyEmployee}
          history={history}
          loading={historyLoading}
          text={text}
          onClose={() => {
            setHistoryEmployee(null);
            setHistory(null);
          }}
        />
      ) : null}
    </DashboardShell>
  );
}

function EmployeeHistoryDrawer({ employee, history, loading, text, onClose }: {
  employee: Employee;
  history: EmployeeScheduleHistory | null;
  loading: boolean;
  text: (typeof copy)["zh-CN"] | (typeof copy)["en-GB"];
  onClose: () => void;
}) {
  const detail = history?.employee ?? employee;
  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/30" role="dialog" aria-modal="true" aria-label={`${detail.name} · ${text.historyTitle}`}>
      <button type="button" className="absolute inset-0" aria-label={text.cancel} onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 z-10 flex w-full max-w-5xl flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-[var(--border)] px-5 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{detail.name} · {text.historyTitle}</h2>
              {detail.deleted_at ? <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-600">{text.deletedEmployee}</span> : null}
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{detail.employee_number} · {detail.position} · {detail.hire_date}–{detail.departure_date ?? "—"}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label={text.cancel} onClick={onClose}><X className="size-5" /></Button>
        </header>

        <div className="grid grid-cols-3 border-b border-[var(--border)] bg-[var(--surface-muted)]/40">
          <HistoryMetric label={text.shiftCount} value={String(history?.summary.shift_count ?? 0)} />
          <HistoryMetric label={text.totalHours} value={`${history?.summary.actual_hours ?? "0.00"}h`} />
          <HistoryMetric label={text.totalWages} value={formatMoney(history?.summary.total_wage)} />
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--surface-muted)] text-left text-xs uppercase text-[var(--muted)]">
              <tr><th className="px-4 py-3">{text.shiftDate}</th><th className="px-4 py-3">{text.shiftTime}</th><th className="px-4 py-3 text-right">{text.breakMinutes}</th><th className="px-4 py-3 text-right">{text.actualHours}</th><th className="px-4 py-3 text-right">{text.hourlyRate}</th><th className="px-4 py-3 text-right">{text.dailyWage}</th><th className="px-4 py-3">{text.workContent}</th></tr>
            </thead>
            <tbody>
              {history?.entries.map((entry) => <tr key={entry.id} className="border-t border-[var(--border)]"><td className="px-4 py-3 font-medium tabular-nums">{entry.work_date}</td><td className="px-4 py-3 tabular-nums">{entry.start_time.slice(0, 5)}–{entry.end_time.slice(0, 5)}</td><td className="px-4 py-3 text-right tabular-nums">{entry.break_minutes}m</td><td className="px-4 py-3 text-right tabular-nums">{entry.actual_hours}h</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(entry.hourly_rate)}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{formatMoney(entry.daily_wage)}</td><td className="px-4 py-3 text-[var(--muted)]">{entry.work_content || "—"}</td></tr>)}
            </tbody>
          </table>
          {loading ? <p className="py-16 text-center text-sm text-[var(--muted)]">{text.historyLoading}</p> : null}
          {!loading && !history?.entries.length ? <p className="py-16 text-center text-sm text-[var(--muted)]">{text.historyEmpty}</p> : null}
        </div>
      </aside>
    </div>
  );
}

function HistoryMetric({ label, value }: { label: string; value: string }) {
  return <div className="border-r border-[var(--border)] px-4 py-4 last:border-r-0 sm:px-6"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>;
}

function EmployeeModal({
  title,
  text,
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  title: string;
  text: (typeof copy)["zh-CN"] | (typeof copy)["en-GB"];
  form: EmployeeInput;
  saving: boolean;
  onChange: (form: EmployeeInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label={text.cancel}
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary-soft)]">
              <UserRound className="size-4" />
            </span>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={text.cancel}
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </header>
        <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={onSubmit}>
          <Field label={text.employeeNumber}>
            <input
              required
              inputMode="numeric"
              maxLength={20}
              className={inputClass}
              value={form.employee_number}
              onChange={(event) =>
                onChange({ ...form, employee_number: event.target.value })
              }
            />
          </Field>
          <Field label={text.name}>
            <input
              required
              maxLength={120}
              className={inputClass}
              value={form.name}
              onChange={(event) =>
                onChange({ ...form, name: event.target.value })
              }
            />
          </Field>
          <Field label={text.gender}>
            <select
              className={inputClass}
              value={form.gender}
              onChange={(event) =>
                onChange({
                  ...form,
                  gender: event.target.value as EmployeeInput["gender"],
                })
              }
            >
              {Object.entries(text.genders).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={text.birthDate}>
            <input
              required
              type="date"
              className={inputClass}
              value={form.date_of_birth}
              onChange={(event) =>
                onChange({ ...form, date_of_birth: event.target.value })
              }
            />
          </Field>
          <Field label={text.hireDate}>
            <input
              required
              type="date"
              className={inputClass}
              value={form.hire_date}
              onChange={(event) =>
                onChange({ ...form, hire_date: event.target.value })
              }
            />
          </Field>
          <Field label={text.position}>
            <input
              required
              maxLength={120}
              className={inputClass}
              value={form.position}
              onChange={(event) =>
                onChange({ ...form, position: event.target.value })
              }
            />
          </Field>
          <Field label={text.hourlyRate}>
            <input
              required
              min="0"
              step="0.01"
              type="number"
              className={inputClass}
              value={form.hourly_rate}
              onChange={(event) =>
                onChange({ ...form, hourly_rate: event.target.value })
              }
            />
          </Field>
          <Field label={text.employmentType}>
            <select
              className={inputClass}
              value={form.employment_type}
              onChange={(event) =>
                onChange({
                  ...form,
                  employment_type: event.target
                    .value as EmployeeInput["employment_type"],
                })
              }
            >
              {Object.entries(text.types).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={text.email}>
            <input
              required
              type="email"
              maxLength={254}
              className={inputClass}
              value={form.email}
              onChange={(event) =>
                onChange({ ...form, email: event.target.value })
              }
            />
          </Field>
          <Field label={text.status}>
            <select
              className={inputClass}
              value={form.status}
              onChange={(event) =>
                onChange({
                  ...form,
                  status: event.target.value as EmployeeInput["status"],
                  departure_date:
                    event.target.value === "DEPARTED"
                      ? form.departure_date
                      : null,
                })
              }
            >
              {Object.entries(text.statuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {form.status === "DEPARTED" ? (
            <Field label={text.departureDate}>
              <input
                required
                type="date"
                min={form.hire_date}
                className={inputClass}
                value={form.departure_date ?? ""}
                onChange={(event) =>
                  onChange({
                    ...form,
                    departure_date: event.target.value || null,
                  })
                }
              />
            </Field>
          ) : null}
          <div className="flex items-end justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {text.cancel}
            </Button>
            <Button type="submit" variant="outline" disabled={saving}>
              {text.save}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function statusClass(status: EmployeeStatus) {
  if (status === "ACTIVE") return "bg-[var(--success-soft)] text-emerald-600";
  if (status === "ON_LEAVE")
    return "bg-[var(--tone-amber-bg)] text-[var(--tone-amber-fg)]";
  return "bg-[var(--danger-soft)] text-rose-600";
}
function formatMoney(value?: string | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value ?? 0));
}
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
const inputClass =
  "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)]";
