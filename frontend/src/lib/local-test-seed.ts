import employeesData from "@/data/test/employees.json";
import activityCategoriesData from "@/data/test/activity-categories.json";
import activityPlansData from "@/data/test/activity-plans.json";
import activityPlatformsData from "@/data/test/activity-platforms.json";
import activityReminderRulesData from "@/data/test/activity-reminder-rules.json";
import businessClosuresData from "@/data/test/business-closures.json";
import businessEventsData from "@/data/test/business-events.json";
import costItemsData from "@/data/test/cost-items.json";
import dashboardData from "@/data/test/dashboard.json";
import holidaysData from "@/data/test/holidays.json";
import ingredientsData from "@/data/test/ingredients.json";
import inventoryOverviewData from "@/data/test/inventory-overview.json";
import inventoryReceiptsData from "@/data/test/inventory-receipts.json";
import monthlyCostsData from "@/data/test/monthly-costs.json";
import productsData from "@/data/test/products.json";
import productionPlanProductsData from "@/data/test/production-plan-products.json";
import productionPlansData from "@/data/test/production-plans.json";
import profitabilityBaselinesData from "@/data/test/profitability-baselines.json";
import salesDataJson from "@/data/test/sales-data.json";
import salesRecordsData from "@/data/test/sales-records.json";
import schedulesData from "@/data/test/schedules.json";
import suppliersData from "@/data/test/suppliers.json";

import type {
  ActivityCategory,
  ActivityPlan,
  ActivityPlatform,
  BakeryProduct,
  BusinessClosure,
  BusinessEvent,
  CalendarHoliday,
  CostItem,
  CostOverview,
  DashboardOverview,
  Employee,
  EmployeeScheduleHistory,
  EventOverview,
  IngredientOption,
  InventoryOverview,
  InventoryReceipt,
  MonthlyCost,
  ProductionPlan,
  ProductionPlanOverview,
  ProfitabilityAnalysis,
  ScheduleEmployeeOption,
  ScheduleEntry,
  SalesDataRecord,
  SalesRecord,
  Supplier,
  WageDetail,
} from "@/lib/api";

const employees = employeesData as Employee[];
const schedules = schedulesData as ScheduleEntry[];
const salesRecords = salesRecordsData as SalesRecord[];
const salesData = salesDataJson as SalesDataRecord[];
const products = productsData as BakeryProduct[];
const ingredients = ingredientsData as IngredientOption[];
const suppliers = suppliersData as Supplier[];
const inventoryOverview = inventoryOverviewData as InventoryOverview;
const inventoryReceipts = inventoryReceiptsData as InventoryReceipt[];
const productionPlans = productionPlansData as ProductionPlan[];
const productionPlanProducts = productionPlanProductsData as ProductionPlanOverview["product_options"];
const costItems = costItemsData as CostItem[];
const monthlyCosts = monthlyCostsData as MonthlyCost[];
const businessEvents = businessEventsData as BusinessEvent[];
const holidays = holidaysData as CalendarHoliday[];
const businessClosures = businessClosuresData as BusinessClosure[];
const dashboard = dashboardData as DashboardOverview;
const profitabilityBaselines = profitabilityBaselinesData as Array<{
  key: string;
  value: ProfitabilityAnalysis;
}>;
const activityCategories = activityCategoriesData as ActivityCategory[];
const activityPlatforms = activityPlatformsData as ActivityPlatform[];
const activityReminderRules = activityReminderRulesData as Array<ActivityPlan["reminder_rule"] & { plan_id: string }>;
const rawActivityPlans = activityPlansData as Array<Omit<ActivityPlan, "category" | "platform" | "reminder_rule"> & { reminder_rule_id: string }>;

function activityDemoPlans(): ActivityPlan[] {
  return rawActivityPlans.map((plan) => {
    // plan_id is the stable relationship; reminder_rule_id is retained for
    // compatibility with older exported test-data files.
    const reminderRule = activityReminderRules.find((item) => item.plan_id === plan.id)
      ?? activityReminderRules.find((item) => item.id === plan.reminder_rule_id);
    if (!reminderRule) throw new Error(`Missing reminder rule for activity plan ${plan.id}`);
    return {
      ...plan,
      category: activityCategories.find((item) => item.id === plan.category_id)!,
      platform: activityPlatforms.find((item) => item.id === plan.platform_id)!,
      reminder_rule: reminderRule,
    };
  });
}

function localDateKey(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function localIsoDate(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
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

function filteredInventoryReceipts(url: URL): InventoryReceipt[] {
  const search = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase();
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";
  return inventoryReceipts.filter((receipt) => {
    const date = receipt.received_at.slice(0, 10);
    if (start && date < start) return false;
    if (end && date > end) return false;
    if (!search) return true;
    return [receipt.reference, receipt.ingredient_name, receipt.supplier_name ?? ""]
      .some((value) => value.toLocaleLowerCase().includes(search));
  });
}

function productionPlanOverview(url: URL): ProductionPlanOverview | undefined {
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end) return undefined;
  const plans = productionPlans.filter(
    (plan) => plan.production_date >= start && plan.production_date <= end,
  );
  const today = localDateKey();
  const futureEnd = new Date(`${today}T12:00:00`);
  futureEnd.setDate(futureEnd.getDate() + 6);
  const futureEndKey = localIsoDate(futureEnd);
  return {
    range: { start, end },
    product_options: productionPlanProducts,
    kpis: {
      today_planned: plans.filter((plan) => plan.production_date === today).reduce((sum, plan) => sum + plan.planned_quantity, 0),
      today_actual: plans.filter((plan) => plan.production_date === today).reduce((sum, plan) => sum + (plan.actual_quantity ?? 0), 0),
      future_7_days_planned: productionPlans.filter((plan) => plan.production_date >= today && plan.production_date <= futureEndKey).reduce((sum, plan) => sum + plan.planned_quantity, 0),
      planned_product_count: new Set(plans.map((plan) => plan.product_id)).size,
    },
    plans,
  };
}

function wageDetails(month: string): WageDetail {
  const grouped = new Map<string, ScheduleEntry[]>();
  for (const entry of schedules.filter((item) => item.work_date.startsWith(month))) {
    const employeeKey = entry.employee ?? `deleted:${entry.employee_name}`;
    grouped.set(employeeKey, [...(grouped.get(employeeKey) ?? []), entry]);
  }
  const rows = [...grouped.entries()].map(([employeeId, entries]) => {
    const employee = employees.find((item) => item.id === employeeId);
    const hours = entries.reduce((sum, item) => sum + Number(item.actual_hours), 0);
    const wage = entries.reduce((sum, item) => sum + Number(item.daily_wage ?? 0), 0);
    return {
      employee_id: employeeId,
      employee_name: employee?.name ?? entries[0]?.employee_name ?? "",
      position: employee?.position ?? entries[0]?.employee_position ?? "",
      hourly_rate: employee?.hourly_rate ?? entries[0]?.hourly_rate ?? "0.00",
      actual_hours: hours.toFixed(2),
      shift_count: entries.length,
      wage: wage.toFixed(2),
      is_deleted: Boolean(employee?.deleted_at),
    };
  });
  return { month, total: rows.reduce((sum, row) => sum + Number(row.wage), 0).toFixed(2), employees: rows };
}

function costOverview(month: string): CostOverview {
  const manualCosts = monthlyCosts.filter((item) => item.cost_month.startsWith(month));
  const wages = wageDetails(month);
  const otherCosts = manualCosts.reduce((sum, item) => sum + Number(item.amount), 0);
  return {
    month,
    summary: {
      total_cost: (otherCosts + Number(wages.total)).toFixed(2),
      employee_wages: wages.total,
      other_costs: otherCosts.toFixed(2),
    },
    wage_entry: {
      source: "SCHEDULE",
      amount: wages.total,
      employee_count: wages.employees.length,
      notes: "Calculated from local test schedules and employee hourly rates.",
    },
    manual_costs: manualCosts,
  };
}

function eventOverview(year: number): EventOverview {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const events = businessEvents.filter((item) => item.start_date <= end && item.end_date >= start);
  const closures = businessClosures.filter((item) => item.start_date <= end && item.end_date >= start);
  return {
    year,
    kpis: {
      upcoming_count: events.filter((item) => item.end_date >= localDateKey()).length,
      next_30_days_count: events.filter((item) => item.status !== "COMPLETED").length,
      in_preparation_count: events.filter((item) => ["PREPARING", "IMMINENT", "PREPARATION_RISK"].includes(item.status)).length,
      needs_attention_count: events.filter((item) => item.status === "PREPARATION_RISK").length,
    },
    product_options: products.map(({ id, name_zh, name_en }) => ({ id, name_zh, name_en })),
    events,
    holidays: holidays.filter((item) => item.holiday_date >= start && item.holiday_date <= end),
    closures,
  };
}

function profitabilityBaseline(url: URL): ProfitabilityAnalysis {
  const exact = profitabilityBaselines.find(({ key }) => key === `BASE:${url.pathname}${url.search}`)?.value;
  if (exact) return exact;
  const start = url.searchParams.get("start") ?? localDateKey();
  const end = url.searchParams.get("end") ?? start;
  const grain = (url.searchParams.get("grain") ?? "day") as ProfitabilityAnalysis["range"]["grain"];
  const allTrend = new Map<string, ProfitabilityAnalysis["trend"][number]>();
  for (const baseline of profitabilityBaselines) {
    for (const item of baseline.value.trend) allTrend.set(item.period, item);
  }
  const trend = [...allTrend.values()].filter((item) => item.period >= start && item.period <= end).sort((a, b) => a.period.localeCompare(b.period));
  const wages = trend.reduce((sum, item) => sum + Number(item.wages), 0);
  const other = trend.reduce((sum, item) => sum + Number(item.other_costs), 0);
  return {
    range: { start, end, grain },
    kpis: { net_sales: "0.00", material_cost: "0.00", missing_material_cost_count: 0, material_cost_complete: true, gross_profit: "0.00", gross_margin: "0.0", wages: wages.toFixed(2), other_costs: other.toFixed(2), operating_profit: (-wages - other).toFixed(2), operating_margin: "0.0" },
    cost_structure: [{ key: "MATERIALS", amount: "0.00" }, { key: "WAGES", amount: wages.toFixed(2) }, { key: "OTHER", amount: other.toFixed(2) }],
    trend: trend.map((item) => ({ ...item, net_sales: "0.00", material_cost: "0.00", gross_profit: "0.00", operating_profit: (-Number(item.wages) - Number(item.other_costs)).toFixed(2) })),
    products: [],
  };
}

function dashboardOverview(date: string): DashboardOverview {
  const dailySales = salesData.filter((record) => record.sales_date === date);
  const dailyPlans = productionPlans.filter(
    (plan) => plan.production_date === date && plan.display_status !== "CANCELLED",
  );
  return {
    ...dashboard,
    business_date: date,
    kpis: {
      ...dashboard.kpis,
      today_net_sales: dailySales.reduce((sum, record) => sum + Number(record.net_sales_amount), 0).toFixed(2),
      today_sales_quantity: dailySales.reduce((sum, record) => sum + record.quantity, 0),
      today_sales_record_count: dailySales.length,
      today_order_count: 0,
      today_planned_production: dailyPlans.reduce((sum, plan) => sum + plan.planned_quantity, 0),
      today_actual_production: dailyPlans.reduce((sum, plan) => sum + (plan.actual_quantity ?? 0), 0),
    },
  };
}

export function getBundledTestEmployee(employeeId: string): Employee | undefined {
  return employees.find((employee) => employee.id === employeeId);
}

export function readBundledTestResponse(path: string): unknown | undefined {
  const url = new URL(path, "http://bakeops.local");

  if (url.pathname === "/products/") return products;
  if (url.pathname === "/suppliers/") {
    const search = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase();
    return suppliers.filter((supplier) => !search || [supplier.code, supplier.name, supplier.contact_name, supplier.email].some((value) => value.toLocaleLowerCase().includes(search)));
  }
  if (url.pathname === "/suppliers/ingredient-options/") return ingredients;
  if (url.pathname === "/inventory/overview/") return { ...inventoryOverview, receipt_ingredient_ids: ingredients.map((item) => item.id) };
  if (url.pathname === "/inventory/receipts/") return filteredInventoryReceipts(url);
  if (url.pathname === "/inventory/production-plans/") return productionPlanOverview(url);
  if (url.pathname === "/costs/items/") return costItems.filter((item) => url.searchParams.get("include_inactive") === "true" || item.is_active);
  if (url.pathname === "/costs/monthly-items/") return monthlyCosts.filter((item) => item.cost_month.startsWith(url.searchParams.get("month") ?? ""));
  if (url.pathname === "/costs/overview/") return costOverview(url.searchParams.get("month") ?? localDateKey().slice(0, 7));
  if (url.pathname === "/costs/wage-details/") return wageDetails(url.searchParams.get("month") ?? localDateKey().slice(0, 7));
  if (url.pathname === "/costs/material-details/") return { month: url.searchParams.get("month") ?? localDateKey().slice(0, 7), total: "0.00", missing_cost_count: 0, items: [] };
  if (url.pathname === "/dashboard/overview/") return dashboardOverview(url.searchParams.get("date") ?? localDateKey());
  if (url.pathname === "/sales/profitability/") return profitabilityBaseline(url);
  if (url.pathname === "/events/overview/") return eventOverview(Number(url.searchParams.get("year") ?? localDateKey().slice(0, 4)));
  if (url.pathname === "/events/closures/") return businessClosures.filter((item) => {
    const start = url.searchParams.get("start") ?? "";
    const end = url.searchParams.get("end") ?? "";
    return (!start || item.end_date >= start) && (!end || item.start_date <= end);
  });
  if (url.pathname === "/events/business-day-status/") {
    const date = url.searchParams.get("date") ?? localDateKey();
    const closures = businessClosures.filter((item) => item.start_date <= date && item.end_date >= date);
    return { date, is_open: closures.length === 0, closures };
  }
  const eventMatch = url.pathname.match(/^\/events\/activities\/([0-9a-f-]+)\/$/i);
  if (eventMatch) {
    const event = businessEvents.find((item) => item.id === eventMatch[1]);
    return event ? { ...event, production_suggestions: [], inventory_suggestions: [] } : undefined;
  }

  if (url.pathname === "/events/activity-planning/plans/") return activityDemoPlans();
  if (url.pathname === "/events/activity-planning/categories/") return activityCategories;
  if (url.pathname === "/events/activity-planning/platforms/") return activityPlatforms;
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
