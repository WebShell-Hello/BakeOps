import employeesData from "@/data/test/employees.json";
import salesDataJson from "@/data/test/sales-data.json";
import salesRecordsData from "@/data/test/sales-records.json";
import schedulesData from "@/data/test/schedules.json";

import type {
  Employee,
  EmployeeScheduleHistory,
  ScheduleEmployeeOption,
  ScheduleEntry,
  SalesDataRecord,
  SalesRecord,
} from "@/lib/api";

const employees = employeesData as Employee[];
const schedules = schedulesData as ScheduleEntry[];
const salesRecords = salesRecordsData as SalesRecord[];
const salesData = salesDataJson as SalesDataRecord[];

function localDateKey(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function filteredEmployees(url: URL): Employee[] {
  const includeDeleted = ["true", "1"].includes(
    (url.searchParams.get("deleted") ?? "false").toLowerCase(),
  );
  const status = url.searchParams.get("status")?.trim() ?? "";
  const search = url.searchParams.get("search")?.trim().toLocaleLowerCase() ?? "";

  return employees.filter((employee) => {
    if (includeDeleted !== Boolean(employee.deleted_at)) return false;
    if (status && employee.status !== status) return false;
    if (!search) return true;
    return [employee.name, employee.employee_number, employee.email ?? "", employee.position]
      .some((value) => value.toLocaleLowerCase().includes(search));
  });
}

function filteredSchedules(url: URL): ScheduleEntry[] | undefined {
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");
  if (!dateFrom || !dateTo) return undefined;
  return schedules.filter(
    (entry) => entry.work_date >= dateFrom && entry.work_date <= dateTo,
  );
}

function employeeOptions(): ScheduleEmployeeOption[] {
  const today = localDateKey();
  return employees
    .filter(
      (employee) =>
        employee.status === "ACTIVE" &&
        !employee.deleted_at &&
        (!employee.hire_date || employee.hire_date <= today),
    )
    .map(({ id, name, position }) => ({ id, name, position }));
}

function employeeScheduleHistory(employeeId: string): EmployeeScheduleHistory | undefined {
  const employee = employees.find((item) => item.id === employeeId);
  if (!employee) return undefined;

  const today = localDateKey();
  const entries = schedules
    .filter((entry) => entry.employee === employeeId && entry.work_date <= today)
    .sort((left, right) =>
      `${right.work_date}T${right.start_time}`.localeCompare(
        `${left.work_date}T${left.start_time}`,
      ),
    );
  const totalHours = entries.reduce(
    (total, entry) => total + Number(entry.actual_hours),
    0,
  );
  const totalWage = entries.reduce(
    (total, entry) => total + Number(entry.daily_wage ?? 0),
    0,
  );

  return {
    employee,
    summary: {
      shift_count: entries.length,
      actual_hours: totalHours.toFixed(2),
      total_wage: totalWage.toFixed(2),
    },
    entries,
  };
}

export function getBundledTestEmployee(employeeId: string): Employee | undefined {
  return employees.find((employee) => employee.id === employeeId);
}

export function readBundledTestResponse(path: string): unknown | undefined {
  const url = new URL(path, "http://bakeops.local");

  if (url.pathname === "/employees/") return filteredEmployees(url);
  if (url.pathname === "/schedules/") return filteredSchedules(url);
  if (url.pathname === "/schedules/employee-options/") return employeeOptions();
  if (url.pathname === "/sales/records/") {
    const search = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase();
    const start = url.searchParams.get("start") ?? "";
    const end = url.searchParams.get("end") ?? "";
    return salesRecords.filter((record) => {
      const date = record.sold_at.slice(0, 10);
      if (start && date < start) return false;
      if (end && date > end) return false;
      if (!search) return true;
      return [record.reference, record.product_name_zh, record.product_name_en]
        .some((value) => value.toLocaleLowerCase().includes(search));
    });
  }
  if (url.pathname === "/sales/data/") {
    const search = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase();
    const channel = url.searchParams.get("channel") ?? "";
    const start = url.searchParams.get("start") ?? "";
    const end = url.searchParams.get("end") ?? "";
    return salesData.filter((record) => {
      if (start && record.sales_date < start) return false;
      if (end && record.sales_date > end) return false;
      if (channel && record.channel !== channel) return false;
      if (!search) return true;
      return [record.product_name_zh, record.product_name_en]
        .some((value) => value.toLocaleLowerCase().includes(search));
    });
  }

  const historyMatch = url.pathname.match(
    /^\/employees\/([0-9a-f-]+)\/schedule-history\/$/i,
  );
  if (historyMatch) return employeeScheduleHistory(historyMatch[1]);

  return undefined;
}
