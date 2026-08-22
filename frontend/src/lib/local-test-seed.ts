import employeesData from "@/data/test/employees.json";
import salesDataJson from "@/data/test/sales-data.json";
import salesRecordsData from "@/data/test/sales-records.json";
import schedulesData from "@/data/test/schedules.json";

import type {
  ActivityCategory,
  ActivityPlan,
  ActivityPlatform,
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

const activityCategories: ActivityCategory[] = [
  { id: "a1000000-0000-4000-8000-000000000001", code: "SOCIAL", name_zh: "社交媒体", name_en: "Social media", colour: "rose", icon_key: "messages-square", position: 10 },
  { id: "a1000000-0000-4000-8000-000000000002", code: "DELIVERY", name_zh: "外卖平台", name_en: "Delivery platform", colour: "blue", icon_key: "bike", position: 20 },
  { id: "a1000000-0000-4000-8000-000000000003", code: "IN_STORE", name_zh: "现场推广", name_en: "In-store promotion", colour: "amber", icon_key: "store", position: 30 },
  { id: "a1000000-0000-4000-8000-000000000004", code: "INFLUENCER", name_zh: "网红合作", name_en: "Influencer", colour: "violet", icon_key: "sparkles", position: 40 },
  { id: "a1000000-0000-4000-8000-000000000005", code: "OTHER", name_zh: "其他", name_en: "Other", colour: "green", icon_key: "megaphone", position: 90 },
];

const activityPlatforms: ActivityPlatform[] = [
  { id: "b1000000-0000-4000-8000-000000000001", category_id: activityCategories[0].id, code: "INSTAGRAM", name_zh: "Instagram", name_en: "Instagram", position: 10 },
  { id: "b1000000-0000-4000-8000-000000000002", category_id: activityCategories[0].id, code: "XIAOHONGSHU", name_zh: "小红书", name_en: "Xiaohongshu", position: 20 },
  { id: "b1000000-0000-4000-8000-000000000003", category_id: activityCategories[0].id, code: "TIKTOK", name_zh: "TikTok", name_en: "TikTok", position: 30 },
  { id: "b1000000-0000-4000-8000-000000000004", category_id: activityCategories[1].id, code: "DELIVEROO", name_zh: "Deliveroo", name_en: "Deliveroo", position: 10 },
  { id: "b1000000-0000-4000-8000-000000000005", category_id: activityCategories[1].id, code: "HUNGRYPANDA", name_zh: "熊猫外卖", name_en: "HungryPanda", position: 20 },
  { id: "b1000000-0000-4000-8000-000000000006", category_id: activityCategories[1].id, code: "UBEREATS", name_zh: "Uber Eats", name_en: "Uber Eats", position: 30 },
  { id: "b1000000-0000-4000-8000-000000000007", category_id: activityCategories[2].id, code: "POSTER", name_zh: "现场海报", name_en: "In-store poster", position: 10 },
  { id: "b1000000-0000-4000-8000-000000000008", category_id: activityCategories[3].id, code: "KOL", name_zh: "网红代言", name_en: "KOL endorsement", position: 10 },
  { id: "b1000000-0000-4000-8000-000000000009", category_id: activityCategories[4].id, code: "OTHER", name_zh: "其他平台", name_en: "Other platform", position: 10 },
];

function activityDemoPlans(): ActivityPlan[] {
  const today = localDateKey();
  const monthStart = `${today.slice(0, 8)}01`;
  const now = new Date().toISOString();
  const makePlan = (
    id: string,
    name: string,
    categoryIndex: number,
    platformIndex: number,
    frequency: ActivityPlan["reminder_rule"]["frequency"],
    reminderTime: string,
    weekdays: number[] = [],
    monthDays: number[] = [],
  ): ActivityPlan => ({
    id,
    name,
    category_id: activityCategories[categoryIndex].id,
    category: activityCategories[categoryIndex],
    platform_id: activityPlatforms[platformIndex].id,
    platform: activityPlatforms[platformIndex],
    description: "",
    priority: platformIndex === 3 ? "HIGH" : "NORMAL",
    status: "ACTIVE",
    start_date: monthStart,
    end_date: null,
    owner_id: null,
    owner_name: "",
    focus_product_ids: [],
    reminder_rule: { id: `${id.slice(0, -1)}9`, frequency, interval: 1, weekdays, month_days: monthDays, reminder_time: reminderTime, timezone: "Europe/London", is_enabled: true },
    next_reminder_at: null,
    created_at: now,
    updated_at: now,
  });
  return [
    makePlan("c1000000-0000-4000-8000-000000000001", "每周发布小红书动态", 0, 1, "WEEKLY", "10:00", [1, 4]),
    makePlan("c1000000-0000-4000-8000-000000000002", "检查 Deliveroo 门店内容", 1, 3, "DAILY", "09:30"),
    makePlan("c1000000-0000-4000-8000-000000000003", "更新门店活动海报", 2, 6, "MONTHLY", "11:00", [], [1, 15]),
  ];
}

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

  if (url.pathname === "/events/activity-planning/plans/") return activityDemoPlans();
  if (url.pathname === "/events/activity-planning/occurrences/") return [];
  if (url.pathname === "/events/activity-planning/overview/") {
    return {
      range: { start: url.searchParams.get("start") ?? localDateKey(), end: url.searchParams.get("end") ?? localDateKey() },
      categories: activityCategories,
      platforms: activityPlatforms,
      owner_options: [],
      product_options: [],
      plans: activityDemoPlans(),
      occurrences: [],
      kpis: { today_pending: 0, overdue: 0, range_pending: 0, active_plans: 3 },
    };
  }

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
