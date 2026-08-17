export type HealthStatus = {
  status: string;
  database: string;
};

export type NavigationItemType = "CATEGORY" | "PAGE";

export type NavigationMenu = {
  id: string;
  code: string;
  name_zh: string;
  name_en: string;
  description: string;
  revision: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type NavigationItem = {
  id: string;
  menu_id: string;
  parent_id: string | null;
  item_type: NavigationItemType;
  key: string;
  label_zh: string;
  label_en: string;
  icon_key: string;
  frontend_path: string | null;
  position: number;
  is_visible: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type NavigationTreeItem = Omit<
  NavigationItem,
  | "menu_id"
  | "parent_id"
  | "is_visible"
  | "is_active"
  | "created_at"
  | "updated_at"
> & {
  children: NavigationTreeItem[];
};

export type NavigationTree = {
  id: string;
  code: string;
  name_zh: string;
  name_en: string;
  revision: number;
  items: NavigationTreeItem[];
};

export type NavigationItemInput = {
  parent_id: string | null;
  item_type: NavigationItemType;
  key: string;
  label_zh: string;
  label_en: string;
  icon_key: string;
  frontend_path: string | null;
  is_visible: boolean;
};

export type NavigationReorderItem = {
  id: string;
  parent_id: string | null;
  position: number;
};

export type AccessRole = {
  id: string;
  code: string;
  name: string;
  description: string;
  is_protected: boolean;
  is_assignable: boolean;
  anonymous_access_mode: "NONE" | "LOGIN_PAGE" | "SYSTEM_PAGE";
  deleted_at: string | null;
  page_ids: string[];
  created_at: string;
  updated_at: string;
};

export type AccessRoleInput = {
  code: string;
  name: string;
  description: string;
  is_protected: boolean;
  anonymous_access_mode?: "NONE" | "LOGIN_PAGE" | "SYSTEM_PAGE";
  page_ids: string[];
};

export type SystemUser = {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_protected: boolean;
  is_superuser: boolean;
  role_ids: string[];
  effective_page_ids: string[];
  last_login: string | null;
  created_at: string;
  updated_at: string;
};

export type SystemUserInput = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_protected: boolean;
  role_ids: string[];
};

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role_names: string[];
  is_superuser: boolean;
  preferences: UserPreferences;
};

export type UserPreferences = {
  theme: "light" | "dark" | "bakery" | "pink";
  locale: "zh-CN" | "en-GB";
  timezone: string;
  date_format: string;
  week_starts_on: number;
  table_page_size: number;
  sidebar_pinned: boolean;
  notification_settings: Record<string, unknown>;
  contract_interaction_settings: Record<string, unknown>;
  extra_settings: Record<string, unknown>;
  updated_at: string;
};

export type LoginInput = {
  email: string;
  password: string;
  remember: boolean;
};

export type RegistrationInput = {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  captcha_id: string;
  captcha_answer: string;
};

export type RegistrationCaptcha = {
  challenge_id: string;
  image_data_url: string;
  expires_in: number;
};

export type CurrentUserProfileInput = {
  username: string;
  first_name: string;
  last_name: string;
};

export type ChangePasswordInput = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

export type ScheduleEntry = {
  id: string;
  employee: string | null;
  employee_name: string;
  work_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  employee_position: string;
  hourly_rate: string | null;
  actual_hours: string;
  daily_wage: string | null;
  employee_is_deleted: boolean;
  employee_status: EmployeeStatus | "";
  work_content: string;
  created_at: string;
  updated_at: string;
};

export type ScheduleEntryInput = {
  employee: string;
  work_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  work_content: string;
};

export type CostCategory =
  | "RENT"
  | "UTILITIES"
  | "INSURANCE"
  | "SOFTWARE"
  | "MAINTENANCE"
  | "CLEANING"
  | "ACCOUNTING"
  | "EQUIPMENT_RENTAL"
  | "WASTE"
  | "MATERIALS"
  | "OTHER";

export type CostItem = {
  id: string;
  name_zh: string;
  name_en: string;
  category: CostCategory;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type CostItemInput = Omit<CostItem, "id" | "created_at" | "updated_at">;

export type MonthlyCost = {
  id: string;
  cost_item: string | null;
  cost_item_name_zh: string;
  cost_item_name_en: string;
  name_zh: string;
  name_en: string;
  category: CostCategory;
  amount: string;
  incurred_date: string;
  cost_month: string;
  source: "MANUAL" | "PRODUCTION";
  is_read_only: boolean;
  calculation_complete: boolean;
  missing_cost_count: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type MonthlyCostInput = {
  cost_item?: string | null;
  name_zh?: string;
  name_en?: string;
  category?: CostCategory;
  amount: string;
  incurred_date: string;
  notes: string;
};

export type MonthlyCostItemInput = {
  name_zh: string;
  name_en: string;
  category: CostCategory;
  notes: string;
  amount?: string;
};

export type CostOverview = {
  month: string;
  summary: {
    total_cost: string;
    employee_wages: string;
    other_costs: string;
  };
  wage_entry: {
    source: "SCHEDULE";
    amount: string;
    employee_count: number;
    notes: string;
  };
  manual_costs: MonthlyCost[];
};

export type SalesAnalysisGrain = "day" | "week" | "month";

export type SalesAnalysis = {
  range: {
    start: string;
    end: string;
    grain: SalesAnalysisGrain;
  };
  kpis: {
    net_sales: string;
    sales_quantity: number;
    order_count: number;
    average_order_value: string;
    discount_amount: string;
    refund_amount: string;
  };
  trend: Array<{
    period: string;
    net_sales: string;
    standard_sales: string;
    discount: string;
    refunds: string;
    quantity: number;
    order_count: number;
  }>;
  products: Array<{
    product_id: string;
    product_name_zh: string;
    product_name_en: string;
    quantity: number;
    standard_sales: string;
    discount: string;
    refunds: string;
    net_sales: string;
    standard_unit_price: string;
    actual_average_price: string;
    price_realisation_rate: string;
  }>;
  hourly: Array<{
    hour: number;
    net_sales: string;
    quantity: number;
    order_count: number;
  }>;
};

export type DashboardOverview = {
  generated_at: string;
  business_date: string;
  kpis: {
    today_net_sales: string;
    today_sales_quantity: number;
    today_order_count: number;
    today_planned_production: number;
    today_actual_production: number;
    daily_estimated_cost: {
      total: string | null;
      material_cost: string;
      labour_cost: string;
      allocated_operating_cost: string;
      direct_daily_cost: string;
      planned_business_days: number;
      production_source: "ACTUAL" | "PLAN";
      labour_source: "ACTUAL" | "PLAN";
      calculation_complete: boolean;
      missing_cost_count: number;
    };
    inventory_risk_count: number;
    event_risk_count: number;
  };
  sales_trend: Array<{ date: string; net_sales: string; order_count: number }>;
  sales_mix: Array<{
    product_id: string | null;
    product_name_zh: string;
    product_name_en: string;
    net_sales: string;
    share: string;
  }>;
  top_products: SalesAnalysis["products"];
  inventory_risks: Array<{
    ingredient_id: string;
    ingredient_name: string;
    status: "EMERGENCY" | "PURCHASE_REQUIRED" | "WATCH";
    current_stock: string;
    unit: string;
    shortage_date: string | null;
  }>;
  event_risks: Array<{
    id: string;
    name: string;
    start_date: string;
    days_until_start: number;
    checklist_completed: number;
    checklist_total: number;
  }>;
};

export type ProfitabilityAnalysisGrain = "day" | "week" | "month";

export type ProfitabilityAnalysis = {
  range: {
    start: string;
    end: string;
    grain: ProfitabilityAnalysisGrain;
  };
  kpis: {
    net_sales: string;
    material_cost: string;
    gross_profit: string;
    gross_margin: string;
    wages: string;
    other_costs: string;
    operating_profit: string;
    operating_margin: string;
  };
  cost_structure: Array<{
    key: "MATERIALS" | "WAGES" | "OTHER";
    amount: string;
  }>;
  trend: Array<{
    period: string;
    net_sales: string;
    material_cost: string;
    gross_profit: string;
    wages: string;
    other_costs: string;
    operating_profit: string;
  }>;
  products: Array<{
    product_id: string;
    product_name_zh: string;
    product_name_en: string;
    quantity: number;
    net_sales: string;
    material_cost: string;
    contribution_profit: string;
    contribution_margin: string;
    contribution_share: string;
    quadrant: "STAR" | "POTENTIAL" | "TRAFFIC" | "REVIEW";
  }>;
};

export type WageDetail = {
  month: string;
  total: string;
  employees: Array<{
    employee_id: string;
    employee_name: string;
    position: string;
    hourly_rate: string;
    actual_hours: string;
    shift_count: number;
    wage: string;
    is_deleted: boolean;
  }>;
};

export type MaterialDetail = {
  month: string;
  total: string;
  missing_cost_count: number;
  items: Array<{
    production_plan_id: string;
    production_date: string;
    product_id: string;
    product_name_zh: string;
    product_name_en: string;
    planned_quantity: number;
    actual_quantity: number;
    remaining_planned_quantity: number;
    actual_unit_cost: string | null;
    planned_unit_cost: string | null;
    actual_cost: string | null;
    planned_cost: string | null;
    total_cost: string;
    source: "ACTUAL" | "PLAN";
    calculation_complete: boolean;
  }>;
};

export type EmployeeGender = "UNSPECIFIED" | "FEMALE" | "MALE" | "OTHER";
export type EmploymentType = "FULL_TIME" | "PART_TIME";
export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "DEPARTED" | "SUSPENDED";

export type Employee = {
  id: string;
  employee_number: string;
  name: string;
  gender: EmployeeGender;
  date_of_birth: string;
  hire_date: string;
  departure_date: string | null;
  position: string;
  hourly_rate: string;
  employment_type: EmploymentType;
  email: string;
  status: EmployeeStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeInput = Omit<
  Employee,
  "id" | "deleted_at" | "created_at" | "updated_at"
>;

export type ScheduleEmployeeOption = {
  id: string;
  name: string;
  position: string;
};

export type EmployeeScheduleHistory = {
  employee: Employee;
  summary: {
    shift_count: number;
    actual_hours: string;
    total_wage: string;
  };
  entries: ScheduleEntry[];
};

export type ProductSaleStatus = "ON_SALE" | "OFF_SALE";

export type ProductRecipeIngredient = {
  id: string;
  section_id: string;
  section_name: string;
  ingredient_name: string;
  weight: string;
  unit: string;
  estimated_price: string | null;
  preparation_note: string;
  position: number;
};

export type ProductRecipeSection = {
  id: string;
  name: string;
  position: number;
  items: ProductRecipeIngredient[];
};

export type ActiveProductRecipe = {
  id: string;
  version: number;
  yield_quantity: number;
  yield_unit: string;
  production_description: string;
  total_weight: string;
  sections: ProductRecipeSection[];
};

export type BakeryProduct = {
  id: string;
  code: string;
  name_zh: string;
  name_en: string;
  sale_status: ProductSaleStatus;
  notes: string;
  active_recipe: ActiveProductRecipe | null;
  current_estimated_cost: {
    amount: string | null;
    currency: string;
    is_complete: boolean;
    missing_ingredient_count: number;
    missing_ingredients: string[];
  } | null;
  created_at: string;
  updated_at: string;
};

export type BakeryProductInput = {
  name_zh: string;
  name_en: string;
  sale_status: ProductSaleStatus;
  notes: string;
  yield_quantity: number;
  yield_unit: string;
  production_description: string;
};

export type ProductIngredientInput = {
  ingredient_name: string;
  section_name: string;
  weight: string;
  unit: string;
  preparation_note: string;
};

export type SupplierIngredient = {
  id: string;
  ingredient: string;
  ingredient_name: string;
  ingredient_base_unit: string;
  unit_price: string;
  currency: string;
  price_unit: string;
  minimum_order_quantity: string;
  minimum_order_unit: string;
  lead_time_days: number;
  notes: string;
  is_active: boolean;
  is_preferred: boolean;
  created_at: string;
  updated_at: string;
};

export type SupplierIngredientInput = {
  ingredient: string;
  unit_price: string;
  currency: string;
  price_unit: string;
  minimum_order_quantity: string;
  minimum_order_unit: string;
  lead_time_days: number;
  notes: string;
  is_active: boolean;
  is_preferred: boolean;
};

export type Supplier = {
  id: string;
  code: string;
  name: string;
  address: string;
  contact_name: string;
  phone: string;
  email: string;
  notes: string;
  supplied_ingredient_count: number;
  supplied_ingredients: SupplierIngredient[];
  created_at: string;
  updated_at: string;
};

export type SupplierInput = {
  name: string;
  address: string;
  contact_name: string;
  phone: string;
  email: string;
  notes: string;
};

export type IngredientOption = {
  id: string;
  name: string;
  base_unit: string;
};

export type InventoryPurchaseStatus =
  | "NORMAL"
  | "WATCH"
  | "PURCHASE_REQUIRED"
  | "EMERGENCY"
  | "NO_DEMAND";

export type InventoryDemandSource = {
  product_id: string;
  product_name_zh: string;
  product_name_en: string;
  quantity: string;
  unit: string;
};

export type InventorySupplierRecommendation = {
  supplier_id: string;
  supplier_name: string;
  unit_price: string;
  currency: string;
  price_unit: string;
  lead_time_days: number;
  minimum_order_quantity: string;
  minimum_order_unit: string;
  is_preferred: boolean;
};

export type InventoryForecastItem = {
  id: string | null;
  ingredient_id: string;
  ingredient_name: string;
  current_stock: string;
  demand_14_days: string;
  production_day_count: number;
  average_production_day_demand: string | null;
  unit: string;
  covered_production_days: number | null;
  covers_all_planned_demand: boolean;
  shortage_date: string | null;
  recommended_order_date: string | null;
  status: InventoryPurchaseStatus;
  safety_buffer_days: number;
  demand_sources: InventoryDemandSource[];
  daily_demands: Array<{
    date: string;
    quantity: string;
    remaining_stock: string;
    is_covered: boolean;
  }>;
  supplier: InventorySupplierRecommendation | null;
  recommended_order_quantity: string | null;
};

export type InventoryOverview = {
  generated_at: string;
  horizon_days: number;
  kpis: {
    ingredient_count: number;
    purchase_required_count: number;
    shortage_within_7_days_count: number;
    no_demand_count: number;
  };
  items: InventoryForecastItem[];
};

export type InventoryPurchaseRequest = {
  id: string;
  reference: string;
  ingredient_name: string;
  supplier_name: string;
  quantity: string;
  unit: string;
  unit_price: string;
  currency: string;
  price_unit: string;
  status: "DRAFT" | "SUBMITTED" | "CONVERTED" | "CANCELLED";
  created_at: string;
};

export type InventoryReceipt = {
  id: string;
  reference: string;
  ingredient_id: string;
  ingredient_name: string;
  supplier_id: string | null;
  supplier_name: string | null;
  quantity: string;
  unit: string;
  unit_price: string | null;
  currency: string;
  price_unit: string;
  total_cost: string | null;
  current_stock: string;
  notes: string;
  received_at: string;
  created_by_name: string | null;
  created_at: string;
};

export type ProductionPlanDisplayStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "MISSING_ACTUAL"
  | "CANCELLED";

export type ProductionPlan = {
  id: string;
  reference: string;
  production_date: string;
  product_id: string;
  product_name_zh: string;
  product_name_en: string;
  planned_quantity: number;
  actual_quantity: number | null;
  difference: number | null;
  completion_rate: number | null;
  display_status: ProductionPlanDisplayStatus;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type ProductionPlanOverview = {
  range: { start: string; end: string };
  product_options: Array<{
    id: string;
    name_zh: string;
    name_en: string;
  }>;
  kpis: {
    today_planned: number;
    today_actual: number;
    future_7_days_planned: number;
    planned_product_count: number;
  };
  plans: ProductionPlan[];
};

export type ProductionPlanBatchInput = {
  production_date: string;
  items: Array<{
    product_id: string;
    planned_quantity: number;
    actual_quantity?: number | null;
  }>;
  notes: string;
  override_business_closure?: boolean;
};

export type BusinessEventType =
  | "PROMOTION"
  | "KOL_COLLABORATION"
  | "CUSTOMER_LOYALTY"
  | "PRODUCT_LAUNCH"
  | "MEMBER_EVENT"
  | "MARKETING"
  | "SPECIAL_ORDER"
  | "OFFLINE_PARTNERSHIP"
  | "OTHER";

export type BusinessEventStatus =
  | "NOT_PREPARING"
  | "PREPARING"
  | "IMMINENT"
  | "PREPARATION_RISK"
  | "COMPLETED";

export type EventChecklistCategory =
  | "PRODUCT_PRODUCTION"
  | "INVENTORY_PURCHASING"
  | "STORE_OPERATIONS"
  | "MARKETING";

export type EventChecklistItem = {
  id: string;
  category: EventChecklistCategory;
  title_zh: string;
  title_en: string;
  is_completed: boolean;
  position: number;
};

export type BusinessEvent = {
  id: string;
  name: string;
  event_type: BusinessEventType;
  start_date: string;
  end_date: string;
  duration_days: number;
  preparation_days: number;
  preparation_start_date: string;
  expected_impact: "LOW" | "MEDIUM" | "HIGH";
  expected_sales_change: string;
  focus_products: Array<{ id: string; name_zh: string; name_en: string }>;
  estimated_cost: string | null;
  currency: string;
  notes: string;
  linked_holiday_id: string | null;
  status: BusinessEventStatus;
  days_until_start: number;
  checklist_completed: number;
  checklist_total: number;
  checklist_items: EventChecklistItem[];
  created_at: string;
  updated_at: string;
};

export type BusinessEventInput = {
  name: string;
  event_type: BusinessEventType;
  start_date: string;
  end_date: string;
  preparation_days: number;
  expected_impact: "LOW" | "MEDIUM" | "HIGH";
  expected_sales_change: string;
  focus_product_ids: string[];
  estimated_cost: string | null;
  currency: string;
  notes: string;
  linked_holiday_id: string | null;
};

export type CalendarHoliday = {
  id: string;
  code: string;
  name_zh: string;
  name_en: string;
  holiday_date: string;
  region: string;
  notes: string;
};

export type BusinessClosureType =
  | "REST_DAY"
  | "TEMPORARY_CLOSURE"
  | "STAFF_LEAVE"
  | "MAINTENANCE"
  | "RENOVATION"
  | "OTHER";

export type BusinessClosure = {
  id: string;
  name: string;
  closure_type: BusinessClosureType;
  start_date: string;
  end_date: string;
  duration_days: number;
  notes: string;
};

export type BusinessClosureInput = Omit<BusinessClosure, "id" | "duration_days">;

export type EventOverview = {
  year: number;
  kpis: {
    upcoming_count: number;
    next_30_days_count: number;
    in_preparation_count: number;
    needs_attention_count: number;
  };
  product_options: Array<{ id: string; name_zh: string; name_en: string }>;
  events: BusinessEvent[];
  holidays: CalendarHoliday[];
  closures: BusinessClosure[];
};

export type BusinessEventDetail = BusinessEvent & {
  production_suggestions: Array<{
    product_id: string;
    product_name_zh: string;
    product_name_en: string;
    current_quantity: number;
    suggested_quantity: number;
    suggested_increase: number;
  }>;
  inventory_suggestions: Array<{
    ingredient_id: string;
    ingredient_name: string;
    current_stock: string;
    original_demand: string;
    extra_demand: string;
    recommended_additional_quantity: string;
    recommendation: "INCREASE" | "SUFFICIENT";
    unit: string;
  }>;
};

export type BusinessDayStatus = {
  date: string;
  is_open: boolean;
  closures: BusinessClosure[];
};

export type ProductionPlanUpdateInput = {
  planned_quantity?: number;
  actual_quantity?: number | null;
  notes?: string;
};

export const BAKEOPS_DATA_CHANGE_EVENT = "bakeops-data-change";

const DEFAULT_PUBLIC_API_BASE_URL = "/api/v1";

function getApiBaseUrl() {
  const baseUrl =
    typeof window === "undefined"
      ? process.env.INTERNAL_API_BASE_URL ??
        process.env.NEXT_PUBLIC_API_BASE_URL ??
        DEFAULT_PUBLIC_API_BASE_URL
      : process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error("API base URL is not configured");
  }

  return baseUrl;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const csrfToken = await getCsrfTokenForRequest(method);
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as unknown;
    const error = new Error(
      readApiError(body) ??
        `BakeOps API request failed with status ${response.status}`,
    );
    Object.assign(error, { status: response.status, body });
    throw error;
  }

  if (
    typeof window !== "undefined" &&
    !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)
  ) {
    window.dispatchEvent(new Event(BAKEOPS_DATA_CHANGE_EVENT));
  }

  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

let csrfRequest: Promise<void> | null = null;

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const part = document.cookie.split("; ").find((cookie) => cookie.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : null;
}

async function getCsrfTokenForRequest(method: string) {
  if (typeof window === "undefined" || ["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
    return null;
  }

  let token = readCookie("csrftoken");
  if (token) return token;

  csrfRequest ??= fetch(`${getApiBaseUrl()}/users/auth/csrf/`, {
    credentials: "include",
    cache: "no-store",
  }).then((response) => {
    if (!response.ok) throw new Error("Unable to initialise a secure request.");
  }).finally(() => {
    csrfRequest = null;
  });
  await csrfRequest;
  token = readCookie("csrftoken");
  if (!token) throw new Error("Unable to initialise a secure request.");
  return token;
}

function readApiError(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = readApiError(item);
      if (message) return message;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    for (const [field, item] of Object.entries(record)) {
      const message = readApiError(item);
      if (message) return `${field}: ${message}`;
    }
  }
  return null;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  return apiRequest<HealthStatus>("/health/");
}

export function getCurrentUser() {
  return apiRequest<AuthUser>("/users/auth/me/");
}

export function updateCurrentUserProfile(input: CurrentUserProfileInput) {
  return apiRequest<AuthUser>("/users/auth/me/", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateCurrentUserPreferences(input: Partial<UserPreferences>) {
  return apiRequest<UserPreferences>("/users/auth/preferences/", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function loginUser(input: LoginInput) {
  return apiRequest<AuthUser>("/users/auth/login/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function registerUser(input: RegistrationInput) {
  return apiRequest<AuthUser>("/users/auth/register/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getRegistrationCaptcha() {
  return apiRequest<RegistrationCaptcha>("/users/auth/registration-captcha/");
}

export function logoutUser() {
  return apiRequest<void>("/users/auth/logout/", { method: "POST" });
}

export function changeCurrentUserPassword(input: ChangePasswordInput) {
  return apiRequest<void>("/users/auth/change-password/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getNavigationTree(code = "main-sidebar") {
  return apiRequest<NavigationTree>(`/navigation/menus/${code}/tree/`);
}

export function getNavigationMenus() {
  return apiRequest<NavigationMenu[]>("/navigation/menus/");
}

export function getNavigationItems(menuId: string) {
  return apiRequest<NavigationItem[]>(`/navigation/menus/${menuId}/items/`);
}

export function createNavigationItem(
  menuId: string,
  input: NavigationItemInput,
) {
  return apiRequest<NavigationItem>(`/navigation/menus/${menuId}/items/`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateNavigationItem(
  itemId: string,
  input: Partial<NavigationItemInput>,
) {
  return apiRequest<NavigationItem>(`/navigation/items/${itemId}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function reorderNavigationItems(
  menuId: string,
  revision: number,
  items: NavigationReorderItem[],
) {
  return apiRequest<NavigationMenu>(`/navigation/menus/${menuId}/reorder/`, {
    method: "POST",
    body: JSON.stringify({ revision, items }),
  });
}

export function getAccessRoles() {
  return apiRequest<AccessRole[]>("/access/roles/");
}

export function createAccessRole(input: AccessRoleInput) {
  return apiRequest<AccessRole>("/access/roles/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAccessRole(roleId: string, input: AccessRoleInput) {
  return apiRequest<AccessRole>(`/access/roles/${roleId}/`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteAccessRole(roleId: string) {
  return apiRequest<void>(`/access/roles/${roleId}/`, { method: "DELETE" });
}

export function restoreAccessRole(roleId: string) {
  return apiRequest<AccessRole>(`/access/roles/${roleId}/restore/`, {
    method: "POST",
  });
}

export function getSystemUsers(search = "") {
  const query = search.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : "";
  return apiRequest<SystemUser[]>(`/users/${query}`);
}

export function createSystemUser(input: SystemUserInput) {
  return apiRequest<SystemUser>("/users/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSystemUser(userId: string, input: SystemUserInput) {
  return apiRequest<SystemUser>(`/users/${userId}/`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function resetSystemUserPassword(userId: string) {
  return apiRequest<void>(`/users/${userId}/reset-password/`, {
    method: "POST",
  });
}

export function setSystemUserLocked(userId: string, locked: boolean) {
  return apiRequest<SystemUser>(`/users/${userId}/lock/`, {
    method: "POST",
    body: JSON.stringify({ locked }),
  });
}

export function deleteSystemUser(userId: string) {
  return apiRequest<void>(`/users/${userId}/`, { method: "DELETE" });
}

export function bulkDeleteSystemUsers(userIds: string[]) {
  return apiRequest<void>("/users/bulk-delete/", {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });
}

export function getScheduleEntries(dateFrom: string, dateTo: string) {
  const query = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
  return apiRequest<ScheduleEntry[]>(`/schedules/?${query.toString()}`);
}

export function getCostOverview(month: string) {
  return apiRequest<CostOverview>(`/costs/overview/?month=${encodeURIComponent(month)}`);
}

export function getSalesAnalysis(
  start: string,
  end: string,
  grain: SalesAnalysisGrain,
) {
  const query = new URLSearchParams({ start, end, grain });
  return apiRequest<SalesAnalysis>(`/sales/analysis/?${query}`);
}

export function getDashboardOverview(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiRequest<DashboardOverview>(`/dashboard/overview/${query}`);
}

export function getProfitabilityAnalysis(
  start: string,
  end: string,
  grain: ProfitabilityAnalysisGrain,
) {
  const query = new URLSearchParams({ start, end, grain });
  return apiRequest<ProfitabilityAnalysis>(`/sales/profitability/?${query}`);
}

export function getWageDetails(month: string) {
  return apiRequest<WageDetail>(`/costs/wage-details/?month=${encodeURIComponent(month)}`);
}

export function getMaterialDetails(month: string) {
  return apiRequest<MaterialDetail>(`/costs/material-details/?month=${encodeURIComponent(month)}`);
}

export function getCostItems(includeInactive = false) {
  return apiRequest<CostItem[]>(`/costs/items/${includeInactive ? "?include_inactive=true" : ""}`);
}

export function getMonthlyCostItems(month: string) {
  return apiRequest<MonthlyCost[]>(`/costs/monthly-items/?month=${encodeURIComponent(month)}`);
}

export function createMonthlyCostItem(month: string, input: MonthlyCostItemInput) {
  return apiRequest<MonthlyCost>(`/costs/monthly-items/?month=${encodeURIComponent(month)}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createCostItem(input: CostItemInput) {
  return apiRequest<CostItem>("/costs/items/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCostItem(id: string, input: Partial<CostItemInput>) {
  return apiRequest<CostItem>(`/costs/items/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCostItem(id: string) {
  return apiRequest<void>(`/costs/items/${id}/`, { method: "DELETE" });
}

export function createMonthlyCost(input: MonthlyCostInput, month: string) {
  return apiRequest<MonthlyCost>(`/costs/monthly/?month=${encodeURIComponent(month)}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMonthlyCost(id: string, input: Partial<MonthlyCostInput>) {
  return apiRequest<MonthlyCost>(`/costs/monthly/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteMonthlyCost(id: string) {
  return apiRequest<void>(`/costs/monthly/${id}/`, { method: "DELETE" });
}

export function saveMonthlyCostItems(
  month: string,
  items: Array<{ monthly_cost: string; amount: string }>,
) {
  return apiRequest<void>(`/costs/monthly-items/?month=${encodeURIComponent(month)}`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

export function getActiveScheduleEmployees() {
  return apiRequest<ScheduleEmployeeOption[]>("/schedules/employee-options/");
}

export function getEmployees(search = "", status = "", deleted = false) {
  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  if (status) query.set("status", status);
  if (deleted) query.set("deleted", "true");
  const suffix = query.size ? `?${query.toString()}` : "";
  return apiRequest<Employee[]>(`/employees/${suffix}`);
}

export function getEmployeeScheduleHistory(employeeId: string) {
  return apiRequest<EmployeeScheduleHistory>(`/employees/${employeeId}/schedule-history/`);
}

export function createEmployee(input: EmployeeInput) {
  return apiRequest<Employee>("/employees/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateEmployee(employeeId: string, input: EmployeeInput) {
  return apiRequest<Employee>(`/employees/${employeeId}/`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteEmployee(employeeId: string) {
  return apiRequest<void>(`/employees/${employeeId}/`, { method: "DELETE" });
}

export function restoreEmployee(employeeId: string) {
  return apiRequest<Employee>(`/employees/${employeeId}/restore/`, {
    method: "POST",
  });
}

export function bulkDeleteEmployees(employeeIds: string[]) {
  return apiRequest<void>("/employees/bulk-delete/", {
    method: "POST",
    body: JSON.stringify({ employee_ids: employeeIds }),
  });
}

export function bulkRestoreEmployees(employeeIds: string[]) {
  return apiRequest<void>("/employees/bulk-restore/", {
    method: "POST",
    body: JSON.stringify({ employee_ids: employeeIds }),
  });
}

export function createScheduleEntry(input: ScheduleEntryInput) {
  return apiRequest<ScheduleEntry>("/schedules/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateScheduleEntry(
  entryId: string,
  input: ScheduleEntryInput,
) {
  return apiRequest<ScheduleEntry>(`/schedules/${entryId}/`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteScheduleEntry(entryId: string) {
  return apiRequest<void>(`/schedules/${entryId}/`, { method: "DELETE" });
}

export function bulkDeleteScheduleEntries(scheduleIds: string[]) {
  return apiRequest<void>("/schedules/bulk-delete/", {
    method: "POST",
    body: JSON.stringify({ schedule_ids: scheduleIds }),
  });
}

export function getBakeryProducts() {
  return apiRequest<BakeryProduct[]>("/products/");
}

export function createBakeryProduct(input: BakeryProductInput) {
  return apiRequest<BakeryProduct>("/products/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBakeryProduct(
  productId: string,
  input: BakeryProductInput,
) {
  return apiRequest<BakeryProduct>(`/products/${productId}/`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function createProductIngredient(
  productId: string,
  input: ProductIngredientInput,
) {
  return apiRequest<ProductRecipeIngredient>(
    `/products/${productId}/ingredients/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateProductIngredient(
  itemId: string,
  input: ProductIngredientInput,
) {
  return apiRequest<ProductRecipeIngredient>(
    `/products/ingredients/${itemId}/`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export function deleteProductIngredient(itemId: string) {
  return apiRequest<void>(`/products/ingredients/${itemId}/`, {
    method: "DELETE",
  });
}

export function getSuppliers(search = "") {
  const query = search.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : "";
  return apiRequest<Supplier[]>(`/suppliers/${query}`);
}

export function getInventoryOverview() {
  return apiRequest<InventoryOverview>("/inventory/overview/");
}

export function createInventoryPurchaseRequest(input: {
  ingredient_id: string;
  quantity: string;
  unit: string;
}) {
  return apiRequest<InventoryPurchaseRequest>("/inventory/purchase-requests/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createInventoryReceipt(input: {
  ingredient_id: string;
  supplier_id: string;
  quantity: string;
  unit: string;
  unit_price: string;
  received_at: string;
  notes: string;
}) {
  return apiRequest<InventoryReceipt>("/inventory/receipts/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getInventoryReceipts(filters: {
  search?: string;
  start?: string;
  end?: string;
} = {}) {
  const query = new URLSearchParams();
  if (filters.search?.trim()) query.set("search", filters.search.trim());
  if (filters.start) query.set("start", filters.start);
  if (filters.end) query.set("end", filters.end);
  const suffix = query.size ? `?${query}` : "";
  return apiRequest<InventoryReceipt[]>(`/inventory/receipts/${suffix}`);
}

export function getProductionPlans(start: string, end: string) {
  const query = new URLSearchParams({ start, end });
  return apiRequest<ProductionPlanOverview>(`/inventory/production-plans/?${query}`);
}

export function createProductionPlans(input: ProductionPlanBatchInput) {
  return apiRequest<ProductionPlan[]>("/inventory/production-plans/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProductionPlan(planId: string, input: ProductionPlanUpdateInput) {
  return apiRequest<ProductionPlan>(`/inventory/production-plans/${planId}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteProductionPlan(planId: string) {
  return apiRequest<void>(`/inventory/production-plans/${planId}/`, { method: "DELETE" });
}

export function getEventOverview(year: number) {
  return apiRequest<EventOverview>(`/events/overview/?year=${year}`);
}

export function getBusinessEvent(eventId: string) {
  return apiRequest<BusinessEventDetail>(`/events/activities/${eventId}/`);
}

export function createBusinessEvent(input: BusinessEventInput) {
  return apiRequest<BusinessEvent>("/events/activities/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBusinessEvent(eventId: string, input: Partial<BusinessEventInput>) {
  return apiRequest<BusinessEvent>(`/events/activities/${eventId}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteBusinessEvent(eventId: string) {
  return apiRequest<void>(`/events/activities/${eventId}/`, { method: "DELETE" });
}

export function createEventChecklistItem(eventId: string, input: {
  category: EventChecklistCategory;
  title_zh?: string;
  title_en?: string;
}) {
  return apiRequest<EventChecklistItem>(`/events/activities/${eventId}/checklist/`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateEventChecklistItem(itemId: string, input: Partial<EventChecklistItem>) {
  return apiRequest<EventChecklistItem>(`/events/checklist/${itemId}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteEventChecklistItem(itemId: string) {
  return apiRequest<void>(`/events/checklist/${itemId}/`, { method: "DELETE" });
}

export function createBusinessClosure(input: BusinessClosureInput) {
  return apiRequest<BusinessClosure>("/events/closures/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBusinessClosure(closureId: string, input: Partial<BusinessClosureInput>) {
  return apiRequest<BusinessClosure>(`/events/closures/${closureId}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteBusinessClosure(closureId: string) {
  return apiRequest<void>(`/events/closures/${closureId}/`, { method: "DELETE" });
}

export function getBusinessDayStatus(date: string) {
  return apiRequest<BusinessDayStatus>(`/events/business-day-status/?date=${encodeURIComponent(date)}`);
}

export function createSupplier(input: SupplierInput) {
  return apiRequest<Supplier>("/suppliers/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSupplier(
  supplierId: string,
  input: Partial<SupplierInput>,
) {
  return apiRequest<Supplier>(`/suppliers/${supplierId}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getSupplierIngredientOptions() {
  return apiRequest<IngredientOption[]>("/suppliers/ingredient-options/");
}

export function createSupplierIngredient(
  supplierId: string,
  input: SupplierIngredientInput,
) {
  return apiRequest<SupplierIngredient>(
    `/suppliers/${supplierId}/ingredients/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateSupplierIngredient(
  itemId: string,
  input: Partial<SupplierIngredientInput>,
) {
  return apiRequest<SupplierIngredient>(`/suppliers/ingredients/${itemId}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
