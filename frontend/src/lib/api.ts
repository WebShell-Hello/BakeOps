import { isAuthenticatedLocally, getDataMode, setDataMode, setAuthenticated } from "@/lib/data-mode";
import { readTestMutations, readTestResponse, readTestResponsesByPrefix, writeTestMutation, writeTestMutations, writeTestResponse } from "@/lib/local-test-db";
import { getBundledTestEmployee, readBundledTestResponse } from "@/lib/local-test-seed";

export { apiRequest };

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
  system_mode: "TEST" | "PRODUCTION";
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
  system_mode?: "TEST" | "PRODUCTION";
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
  system_mode: "TEST" | "PRODUCTION";
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

export type SalesRecord = {
  id: string;
  order_id: string;
  reference: string;
  sold_at: string;
  product_id: string;
  product_name_zh: string;
  product_name_en: string;
  quantity: number;
  standard_unit_price: string;
  standard_sales_amount: string;
  discount_amount: string;
  paid_amount: string;
  refund_amount: string;
  net_sales_amount: string;
  created_at: string;
  updated_at: string;
};

export type SalesRecordInput = {
  reference: string;
  sold_at: string;
  product_id: string;
  product_name_zh?: string;
  product_name_en?: string;
  quantity: number;
  standard_unit_price: string;
  discount_amount: string;
  paid_amount: string;
  refund_amount: string;
};

export type SalesChannel = "DIRECT" | "CONSIGNMENT" | "DELIVERY";

export type SalesDataRecord = {
  id: string;
  sales_date: string;
  channel: SalesChannel;
  product_id: string;
  product_name_zh: string;
  product_name_en: string;
  quantity: number;
  received_amount: string;
  discount_amount: string;
  refund_amount: string;
  standard_sales_amount: string;
  net_sales_amount: string;
  created_at: string;
  updated_at: string;
};

export type SalesDataInput = {
  sales_date: string;
  channel: SalesChannel;
  product_id: string;
  product_name_zh?: string;
  product_name_en?: string;
  quantity: number;
  received_amount: string;
  discount_amount: string;
  refund_amount: string;
};

export type SalesAnalysis = {
  range: {
    start: string;
    end: string;
    grain: SalesAnalysisGrain;
  };
  kpis: {
    net_sales: string;
    standard_sales?: string;
    sales_quantity: number;
    record_count?: number;
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
    record_count?: number;
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
  channels?: Array<{
    channel: SalesChannel;
    quantity: number;
    standard_sales: string;
    net_sales: string;
  }>;
};

export type DashboardOverview = {
  generated_at: string;
  business_date: string;
  kpis: {
    today_net_sales: string;
    today_sales_quantity: number;
    today_sales_record_count: number;
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
  sales_trend: Array<{ date: string; net_sales: string; record_count: number; order_count: number }>;
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
    missing_material_cost_count?: number;
    material_cost_complete?: boolean;
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
    missing_material_cost_count?: number;
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
    missing_material_cost_count?: number;
    material_cost_complete?: boolean;
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
  date_of_birth: string | null;
  hire_date: string | null;  departure_date: string | null;
  position: string;
  hourly_rate: string;
  employment_type: EmploymentType;
  email: string | null;
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
  ingredient_id?: string;
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
  receipt_ingredient_ids: string[];
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
  created_by_id: string | null;
  created_by_name: string | null;
  invoice_name: string;
  invoice_size: number | null;
  invoice_download_url: string | null;
  invoice_file?: File | null;
  created_at: string;
};

export type InventoryRecorderOption = {
  id: string;
  username: string;
  email: string;
};

export type InventoryReceiptInput = {
  ingredient_id?: string;
  ingredient_name?: string;
  supplier_id: string;
  supplier_name?: string;
  quantity: string;
  unit: string;
  unit_price: string;
  currency?: string;
  price_unit?: string;
  received_at: string;
  notes: string;
  recorded_by_id: string;
  recorded_by_name?: string;
  invoice?: File | null;
  remove_invoice?: boolean;
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

function collectionRoot(path: string): { root: string; id: string | null } {
  const clean = path.split("?", 1)[0];
  const parts = clean.split("/").filter(Boolean);
  if (parts.length <= 1) return { root: clean.endsWith("/") ? clean : `${clean}/`, id: null };
  const last = parts.at(-1) ?? "";
  const looksLikeId = /^[0-9a-f-]{8,}$/i.test(last);
  return looksLikeId ? { root: `/${parts.slice(0, -1).join("/")}/`, id: last } : { root: clean.endsWith("/") ? clean : `${clean}/`, id: null };
}

function applyLocalMutations<T>(value: T, mutations: Awaited<ReturnType<typeof readTestMutations>>): T {
  if (!Array.isArray(value) && !(value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results))) return value;
  const rows = Array.isArray(value) ? value : (value as unknown as { results: unknown[] }).results;
  const rowMap = new Map<string, Record<string, unknown>>();
  const order = (rows as Array<Record<string, unknown>>).map((row, index) => {
    const key = row.id === undefined ? `__local_row_${index}` : String(row.id);
    rowMap.set(key, row);
    return key;
  });
  const addedKeys: string[] = [];
  for (const mutation of mutations) {
    if (mutation.method === "DELETE_NESTED_SUPPLIER_INGREDIENT") {
      for (const key of order) {
        const row = rowMap.get(key);
        if (!row) continue;
        const suppliedIngredients = row.supplied_ingredients;
        if (!Array.isArray(suppliedIngredients)) continue;
        const remaining = suppliedIngredients.filter(
          (item) => String((item as { id?: unknown }).id) !== mutation.id,
        );
        if (remaining.length !== suppliedIngredients.length) {
          rowMap.set(key, {
            ...row,
            supplied_ingredients: remaining,
            supplied_ingredient_count: remaining.filter(
              (item) => Boolean((item as { is_active?: unknown }).is_active),
            ).length,
          });
        }
      }
      continue;
    }
    const key = mutation.id;
    if (mutation.method === "DELETE") {
      if (key) rowMap.delete(key);
      continue;
    }
    if (!mutation.value || typeof mutation.value !== "object") continue;
    if (key && rowMap.has(key)) {
      rowMap.set(key, { ...rowMap.get(key), ...(mutation.value as Record<string, unknown>) });
    } else {
      const nextKey = key ?? `__local_mutation_${mutation.key}`;
      rowMap.set(nextKey, mutation.value as Record<string, unknown>);
      addedKeys.push(nextKey);
    }
  }
  const next = [...addedKeys.reverse(), ...order].flatMap((key) => {
    const row = rowMap.get(key);
    return row ? [row] : [];
  });
  return (Array.isArray(value) ? next : { ...(value as object), results: next }) as T;
}

async function readCompatibleProductionPlanOverview(path: string) {
  const requestUrl = new URL(path, "http://bakeops.local");
  if (requestUrl.pathname !== "/inventory/production-plans/") return undefined;
  const start = requestUrl.searchParams.get("start") ?? "";
  const end = requestUrl.searchParams.get("end") ?? "";
  if (!start || !end) return undefined;

  const mutations = await readTestMutations("/inventory/production-plans/");
  const candidates = await readTestResponsesByPrefix<ProductionPlanOverview>(
    "BASE:/inventory/production-plans/?",
  );
  const compatible = candidates.flatMap((candidate) => {
    const overview = candidate.value;
    if (
      !overview?.range ||
      !Array.isArray(overview.plans) ||
      overview.range.start > start ||
      overview.range.end < end
    ) {
      return [];
    }
    const plansWithMutations = applyLocalMutations(overview.plans, mutations);
    const plans = plansWithMutations.filter(
      (plan) => plan.production_date >= start && plan.production_date <= end,
    );
    return [{
      updatedAt: candidate.updatedAt,
      overview: {
        ...overview,
        range: { start, end },
        kpis: {
          ...overview.kpis,
          planned_product_count: new Set(plans.map((plan) => plan.product_id)).size,
        },
        plans,
      },
    }];
  });
  compatible.sort(
    (left, right) =>
      right.overview.plans.length - left.overview.plans.length ||
      right.updatedAt - left.updatedAt,
  );
  return compatible[0]?.overview;
}

function parseLocalMutationBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (!body) return {};
  if (!(body instanceof FormData)) return JSON.parse(String(body)) as Record<string, unknown>;
  const parsed: Record<string, unknown> = {};
  for (const [key, entry] of body.entries()) {
    if (key.startsWith("_local_")) {
      parsed[key.slice(7)] = entry;
    } else if (key === "invoice" && entry instanceof File) {
      parsed.invoice_file = entry;
      parsed.invoice_name = entry.name;
      parsed.invoice_size = entry.size;
      parsed.invoice_download_url = null;
    } else {
      parsed[key] = entry;
    }
  }
  parsed.created_by_id = parsed.recorded_by_id ?? parsed.created_by_id ?? null;
  parsed.created_by_name = parsed.recorded_by_name ?? parsed.created_by_name ?? null;
  delete parsed.recorded_by_id;
  delete parsed.recorded_by_name;
  if (parsed.remove_invoice === "true") {
    parsed.invoice_file = null;
    parsed.invoice_name = "";
    parsed.invoice_size = null;
    parsed.invoice_download_url = null;
  }
  delete parsed.remove_invoice;
  return parsed;
}

async function auditLocalAction(method: string, path: string, resourceId: string | null) {
  try {
    await apiRequest<void>("/audit/client-actions/", {
      method: "POST",
      body: JSON.stringify({
        method,
        path,
        resource_type: path.split("/").filter(Boolean)[0] ?? "",
        resource_id: resourceId,
      }),
    });
  } catch {
    // Audit availability must not block a local test-data operation.
  }
}

async function localTestMutation<T>(path: string, method: string, init?: RequestInit): Promise<T> {
  const parsed = parseLocalMutationBody(init?.body);
  const now = new Date().toISOString();
  const { root, id: pathId } = collectionRoot(path);
  const mutationId = typeof parsed.id === "string" ? parsed.id : pathId ?? crypto.randomUUID();
  if (method === "POST" && path === "/sales/data/import/") {
    const rows = Array.isArray(parsed.records) ? parsed.records as Array<Record<string, unknown>> : [];
    const records = rows.map((row) => {
      const received = Number(row.received_amount ?? 0);
      const discount = Number(row.discount_amount ?? 0);
      const refund = Number(row.refund_amount ?? 0);
      return {
        ...row,
        id: crypto.randomUUID(),
        standard_sales_amount: (received + discount).toFixed(2),
        net_sales_amount: (received - refund).toFixed(2),
        created_at: now,
        updated_at: now,
      };
    });
    await writeTestMutations(records.map((record) => ({
      root: "/sales/data/",
      method: "POST",
      id: record.id,
      value: record,
    })));
    const value = { created_count: records.length, records };
    await writeTestResponse(`${method}:${path}`, value);
    window.dispatchEvent(new Event(BAKEOPS_DATA_CHANGE_EVENT));
    await auditLocalAction(method, path, null);
    return value as T;
  }
  if (method === "POST" && path === "/sales/data/bulk-delete/") {
    const ids = Array.isArray(parsed.record_ids) ? parsed.record_ids.map(String) : [];
    await writeTestMutations(ids.map((id) => ({
      root: "/sales/data/",
      method: "DELETE",
      id,
      value: undefined,
    })));
    await writeTestResponse(`${method}:${path}`, undefined);
    window.dispatchEvent(new Event(BAKEOPS_DATA_CHANGE_EVENT));
    await auditLocalAction(method, path, null);
    return undefined as T;
  }
  if (method === "POST" && path === "/sales/records/import/") {
    const rows = Array.isArray(parsed.records) ? parsed.records as Array<Record<string, unknown>> : [];
    const orderIds = new Map<string, string>();
    const records = [];
    for (const row of rows) {
      const id = crypto.randomUUID();
      const reference = String(row.reference ?? "");
      const orderId = orderIds.get(reference) ?? crypto.randomUUID();
      orderIds.set(reference, orderId);
      const quantity = Number(row.quantity ?? 0);
      const unitPrice = Number(row.standard_unit_price ?? 0);
      const discount = Number(row.discount_amount ?? 0);
      const paid = Number(row.paid_amount ?? quantity * unitPrice - discount);
      const refund = Number(row.refund_amount ?? 0);
      const record = {
        ...row,
        id,
        order_id: orderId,
        standard_sales_amount: (quantity * unitPrice).toFixed(2),
        net_sales_amount: (paid - refund).toFixed(2),
        created_at: now,
        updated_at: now,
      };
      records.push(record);
    }
    await writeTestMutations(records.map((record) => ({
      root: "/sales/records/",
      method: "POST",
      id: record.id,
      value: record,
    })));
    const value = { created_count: records.length, records };
    await writeTestResponse(`${method}:${path}`, value);
    window.dispatchEvent(new Event(BAKEOPS_DATA_CHANGE_EVENT));
    await auditLocalAction(method, path, null);
    return value as T;
  }
  if (method === "POST" && path === "/sales/records/bulk-delete/") {
    const ids = Array.isArray(parsed.line_ids) ? parsed.line_ids.map(String) : [];
    for (const id of ids) await writeTestMutation("/sales/records/", "DELETE", id, undefined);
    await writeTestResponse(`${method}:${path}`, undefined);
    window.dispatchEvent(new Event(BAKEOPS_DATA_CHANGE_EVENT));
    await auditLocalAction(method, path, null);
    return undefined as T;
  }
  const deletesNestedSupplierIngredient =
    method === "DELETE" && root === "/suppliers/ingredients/" && Boolean(pathId);
  const scheduleEmployee = root === "/schedules/" && typeof parsed.employee === "string"
    ? getBundledTestEmployee(parsed.employee)
    : undefined;
  const scheduleStart = typeof parsed.start_time === "string" ? parsed.start_time : "";
  const scheduleEnd = typeof parsed.end_time === "string" ? parsed.end_time : "";
  const scheduleMinutes = scheduleStart && scheduleEnd
    ? Math.max(
        (Number(scheduleEnd.slice(0, 2)) * 60 + Number(scheduleEnd.slice(3, 5))) -
          (Number(scheduleStart.slice(0, 2)) * 60 + Number(scheduleStart.slice(3, 5))) -
          Number(parsed.break_minutes ?? 0),
        0,
      )
    : 0;
  const localReceiptFields = root === "/inventory/receipts/" ? {
    ...(method === "POST" ? {
      reference: parsed.reference ?? `GRN-TEST-${Date.now().toString(36).toUpperCase()}`,
      current_stock: parsed.current_stock ?? "0",
    } : {}),
    total_cost: parsed.total_cost ?? (Number(parsed.quantity ?? 0) * Number(parsed.unit_price ?? 0)).toFixed(2),
  } : {};
  const localEmployeeFields = root === "/employees/" ? {
    deleted_at: parsed.deleted_at ?? null,
  } : {};
  const localScheduleFields = root === "/schedules/" ? {
    employee_name: scheduleEmployee?.name ?? parsed.employee_name ?? "",
    employee_position: scheduleEmployee?.position ?? parsed.employee_position ?? "",
    hourly_rate: scheduleEmployee?.hourly_rate ?? parsed.hourly_rate ?? null,
    actual_hours: (scheduleMinutes / 60).toFixed(2),
    daily_wage: scheduleEmployee
      ? (Number(scheduleEmployee.hourly_rate) * scheduleMinutes / 60).toFixed(2)
      : parsed.daily_wage ?? null,
    employee_is_deleted: Boolean(scheduleEmployee?.deleted_at),
    employee_status: scheduleEmployee?.status ?? parsed.employee_status ?? "",
  } : {};
  const localSalesFields = root === "/sales/records/" ? {
    standard_sales_amount: (
      Number(parsed.quantity ?? 0) * Number(parsed.standard_unit_price ?? 0)
    ).toFixed(2),
    net_sales_amount: (
      Number(parsed.paid_amount ?? 0) - Number(parsed.refund_amount ?? 0)
    ).toFixed(2),
  } : {};
  const localSalesDataFields = root === "/sales/data/" ? {
    standard_sales_amount: (
      Number(parsed.received_amount ?? 0) + Number(parsed.discount_amount ?? 0)
    ).toFixed(2),
    net_sales_amount: (
      Number(parsed.received_amount ?? 0) - Number(parsed.refund_amount ?? 0)
    ).toFixed(2),
  } : {};
  const value = method === "DELETE" ? undefined : {
    ...parsed,
    ...localReceiptFields,
    ...localEmployeeFields,
    ...localScheduleFields,
    ...localSalesFields,
    ...localSalesDataFields,
    id: mutationId,
    ...(method === "POST" ? {
      created_at: typeof parsed.created_at === "string" ? parsed.created_at : now,
    } : {}),
    updated_at: now,
  };
  await writeTestMutation(
    deletesNestedSupplierIngredient ? "/suppliers/" : root,
    deletesNestedSupplierIngredient ? "DELETE_NESTED_SUPPLIER_INGREDIENT" : method,
    pathId ?? mutationId,
    value,
  );
  await writeTestResponse(`${method}:${path}`, value);
  window.dispatchEvent(new Event(BAKEOPS_DATA_CHANGE_EVENT));
  await auditLocalAction(method, path, pathId ?? mutationId);
  return value as T;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const mode = getDataMode();
  const isRead = ["GET", "HEAD", "OPTIONS", "TRACE"].includes(method);
  const serverControlPath = [
    "/users/",
    "/access/",
    "/navigation/",
    "/audit/",
    "/system/",
    "/inventory/receipts/recorder-options/",
  ].some((prefix) => path.startsWith(prefix));
  const usesLocalTestData = mode === "TEST" && !serverControlPath;

  if (usesLocalTestData) {
    if (!isRead && !isAuthenticatedLocally()) {
      const error = new Error("游客测试模式不能保存修改。请登录后再试。");
      Object.assign(error, { status: 403 });
      throw error;
    }
    if (!isRead) return localTestMutation<T>(path, method, init);
    const bundledValue = readBundledTestResponse(path);
    if (bundledValue !== undefined) {
      return applyLocalMutations(
        bundledValue as T,
        await readTestMutations(collectionRoot(path).root),
      );
    }
    const compatibleProductionPlans = await readCompatibleProductionPlanOverview(path);
    if (compatibleProductionPlans !== undefined) {
      return compatibleProductionPlans as T;
    }
    const localValue = await readTestResponse<T>(`${method}:${path}`);
    if (localValue !== undefined) {
      if (!isRead) return localValue;
      return applyLocalMutations(
        localValue,
        await readTestMutations(collectionRoot(path).root),
      );
    }
    if (isRead) {
      const baseValue = await readTestResponse<T>(`BASE:${path}`);
      if (baseValue !== undefined) {
        return applyLocalMutations(
          baseValue,
          await readTestMutations(collectionRoot(path).root),
        );
      }
    }
  }
  const csrfToken = await getCsrfTokenForRequest(method);
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      "X-BakeOps-System-Mode": mode,
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

  const value = (await response.json()) as T;
  if (usesLocalTestData) {
    await writeTestResponse(`BASE:${path}`, value);
  }
  return value;
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

export async function loginUser(input: LoginInput) {
  const user = await apiRequest<AuthUser>("/users/auth/login/", {
    method: "POST",
    body: JSON.stringify(input),
  });
  setAuthenticated(true);
  return user;
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

export async function logoutUser() {
  const result = await apiRequest<void>("/users/auth/logout/", { method: "POST" });
  setAuthenticated(false);
  setDataMode("TEST");
  return result;
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

export async function getSalesAnalysis(
  start: string,
  end: string,
  grain: SalesAnalysisGrain,
  channel: SalesChannel | "" = "",
) {
  if (getDataMode() === "TEST") {
    const records = await getSalesData({ start, end, channel });
    return buildLocalSalesAnalysis(records, start, end, grain);
  }
  const query = new URLSearchParams({ start, end, grain });
  if (channel) query.set("channel", channel);
  return apiRequest<SalesAnalysis>(`/sales/analysis/?${query}`);
}

function buildLocalSalesAnalysis(
  records: SalesDataRecord[],
  start: string,
  end: string,
  grain: SalesAnalysisGrain,
): SalesAnalysis {
  const sum = (values: SalesDataRecord[], key: keyof SalesDataRecord) =>
    values.reduce((total, record) => total + Number(record[key]), 0);
  const netSales = sum(records, "net_sales_amount");
  const groups = new Map<string, SalesDataRecord[]>();
  for (const record of records) {
    const period = localSalesPeriod(record.sales_date, grain);
    groups.set(period, [...(groups.get(period) ?? []), record]);
  }
  const trend = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(
    ([period, items]) => ({
      period,
      net_sales: sum(items, "net_sales_amount").toFixed(2),
      standard_sales: sum(items, "standard_sales_amount").toFixed(2),
      discount: sum(items, "discount_amount").toFixed(2),
      refunds: sum(items, "refund_amount").toFixed(2),
      quantity: sum(items, "quantity"),
      record_count: items.length,
      order_count: 0,
    }),
  );
  const productGroups = new Map<string, SalesDataRecord[]>();
  for (const record of records) {
    productGroups.set(record.product_id, [...(productGroups.get(record.product_id) ?? []), record]);
  }
  const products: SalesAnalysis["products"] = [...productGroups.entries()].map(([productId, items]) => {
    const quantity = sum(items, "quantity");
    const standardSales = sum(items, "standard_sales_amount");
    const productNetSales = sum(items, "net_sales_amount");
    return {
      product_id: productId,
      product_name_zh: items[0].product_name_zh,
      product_name_en: items[0].product_name_en,
      quantity,
      standard_sales: standardSales.toFixed(2),
      discount: sum(items, "discount_amount").toFixed(2),
      refunds: sum(items, "refund_amount").toFixed(2),
      net_sales: productNetSales.toFixed(2),
      standard_unit_price: (quantity ? standardSales / quantity : 0).toFixed(2),
      actual_average_price: (quantity ? productNetSales / quantity : 0).toFixed(2),
      price_realisation_rate: (standardSales ? productNetSales / standardSales * 100 : 0).toFixed(1),
    };
  }).sort((left, right) => Number(right.net_sales) - Number(left.net_sales));
  const channelGroups = new Map<SalesChannel, SalesDataRecord[]>();
  for (const record of records) {
    channelGroups.set(record.channel, [...(channelGroups.get(record.channel) ?? []), record]);
  }
  const channels = [...channelGroups.entries()].map(([channel, items]) => ({
    channel,
    quantity: sum(items, "quantity"),
    standard_sales: sum(items, "standard_sales_amount").toFixed(2),
    net_sales: sum(items, "net_sales_amount").toFixed(2),
  }));
  return {
    range: { start, end, grain },
    kpis: {
      net_sales: netSales.toFixed(2),
      standard_sales: sum(records, "standard_sales_amount").toFixed(2),
      sales_quantity: sum(records, "quantity"),
      record_count: records.length,
      order_count: 0,
      average_order_value: "0.00",
      discount_amount: sum(records, "discount_amount").toFixed(2),
      refund_amount: sum(records, "refund_amount").toFixed(2),
    },
    trend,
    products,
    channels,
    hourly: [],
  };
}

function localSalesPeriod(value: string, grain: SalesAnalysisGrain) {
  const key = value.slice(0, 10);
  if (grain === "day") return key;
  if (grain === "month") return `${key.slice(0, 7)}-01`;
  const monday = new Date(`${key}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export async function getSalesData(filters?: {
  search?: string;
  start?: string;
  end?: string;
  channel?: SalesChannel | "";
}) {
  const query = new URLSearchParams();
  if (filters?.search) query.set("search", filters.search);
  if (filters?.start) query.set("start", filters.start);
  if (filters?.end) query.set("end", filters.end);
  if (filters?.channel) query.set("channel", filters.channel);
  const suffix = query.size ? `?${query.toString()}` : "";
  const records = await apiRequest<SalesDataRecord[]>(`/sales/data/${suffix}`);
  const search = filters?.search?.trim().toLocaleLowerCase() ?? "";
  return records.filter((record) => {
    if (filters?.start && record.sales_date < filters.start) return false;
    if (filters?.end && record.sales_date > filters.end) return false;
    if (filters?.channel && record.channel !== filters.channel) return false;
    if (!search) return true;
    return [record.product_name_zh, record.product_name_en]
      .some((value) => value.toLocaleLowerCase().includes(search));
  }).sort((left, right) =>
    right.sales_date.localeCompare(left.sales_date)
      || left.channel.localeCompare(right.channel)
      || left.product_name_en.localeCompare(right.product_name_en)
  );
}

export function updateSalesData(recordId: string, input: SalesDataInput) {
  return apiRequest<SalesDataRecord>(`/sales/data/${recordId}/`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function importSalesData(records: SalesDataInput[]) {
  return apiRequest<{ created_count: number; records: SalesDataRecord[] }>(
    "/sales/data/import/",
    { method: "POST", body: JSON.stringify({ records }) },
  );
}

export function bulkDeleteSalesData(recordIds: string[]) {
  return apiRequest<void>("/sales/data/bulk-delete/", {
    method: "POST",
    body: JSON.stringify({ record_ids: recordIds }),
  });
}

export async function getSalesRecords(filters?: { search?: string; start?: string; end?: string }) {
  const query = new URLSearchParams();
  if (filters?.search) query.set("search", filters.search);
  if (filters?.start) query.set("start", filters.start);
  if (filters?.end) query.set("end", filters.end);
  const suffix = query.size ? `?${query}` : "";
  const records = await apiRequest<SalesRecord[]>(`/sales/records/${suffix}`);
  const search = filters?.search?.trim().toLocaleLowerCase() ?? "";
  return records.filter((record) => {
    const date = record.sold_at.slice(0, 10);
    if (filters?.start && date < filters.start) return false;
    if (filters?.end && date > filters.end) return false;
    if (!search) return true;
    return [record.reference, record.product_name_zh, record.product_name_en]
      .some((value) => value.toLocaleLowerCase().includes(search));
  });
}

export function updateSalesRecord(recordId: string, input: SalesRecordInput) {
  return apiRequest<SalesRecord>(`/sales/records/${recordId}/`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function importSalesRecords(records: SalesRecordInput[]) {
  return apiRequest<{ created_count: number; records: SalesRecord[] }>(
    "/sales/records/import/",
    { method: "POST", body: JSON.stringify({ records }) },
  );
}

export function bulkDeleteSalesRecords(lineIds: string[]) {
  return apiRequest<void>("/sales/records/bulk-delete/", {
    method: "POST",
    body: JSON.stringify({ line_ids: lineIds }),
  });
}

export function getDashboardOverview(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiRequest<DashboardOverview>(`/dashboard/overview/${query}`);
}

export async function getProfitabilityAnalysis(
  start: string,
  end: string,
  grain: ProfitabilityAnalysisGrain,
) {
  const query = new URLSearchParams({ start, end, grain });
  const base = await apiRequest<ProfitabilityAnalysis>(`/sales/profitability/?${query}`);
  if (getDataMode() !== "TEST") return base;
  const [records, products] = await Promise.all([
    getSalesData({ start, end }),
    getBakeryProducts(),
  ]);
  return buildLocalProfitabilityAnalysis(records, products, base, start, end, grain);
}

function buildLocalProfitabilityAnalysis(
  records: SalesDataRecord[],
  bakeryProducts: BakeryProduct[],
  base: ProfitabilityAnalysis,
  start: string,
  end: string,
  grain: ProfitabilityAnalysisGrain,
): ProfitabilityAnalysis {
  const unitCosts = new Map<string, number | null>();
  for (const product of bakeryProducts) {
    const amount = Number(product.current_estimated_cost?.amount);
    const yieldQuantity = product.active_recipe?.yield_quantity ?? 0;
    unitCosts.set(
      product.id,
      product.current_estimated_cost?.is_complete && Number.isFinite(amount) && yieldQuantity > 0
        ? amount / yieldQuantity
        : null,
    );
  }

  const periodSales = new Map<string, number>();
  const periodMaterial = new Map<string, number>();
  const periodMissing = new Map<string, number>();
  const productGroups = new Map<string, SalesDataRecord[]>();
  let totalSales = 0;
  let totalMaterial = 0;
  let missingMaterialCostCount = 0;

  for (const record of records) {
    const period = localProfitabilityPeriod(record.sales_date, grain);
    const netSales = Number(record.net_sales_amount);
    const unitCost = unitCosts.get(record.product_id) ?? null;
    const materialCost = unitCost === null ? 0 : unitCost * record.quantity;
    totalSales += netSales;
    totalMaterial += materialCost;
    periodSales.set(period, (periodSales.get(period) ?? 0) + netSales);
    periodMaterial.set(period, (periodMaterial.get(period) ?? 0) + materialCost);
    if (unitCost === null) {
      missingMaterialCostCount += 1;
      periodMissing.set(period, (periodMissing.get(period) ?? 0) + 1);
    }
    productGroups.set(record.product_id, [...(productGroups.get(record.product_id) ?? []), record]);
  }

  const baseTrend = new Map(base.trend.map((item) => [item.period, item]));
  const periods = new Set([...baseTrend.keys(), ...periodSales.keys(), ...periodMaterial.keys()]);
  const trend = [...periods].sort().map((period) => {
    const original = baseTrend.get(period);
    const netSales = periodSales.get(period) ?? 0;
    const materialCost = periodMaterial.get(period) ?? 0;
    const wages = Number(original?.wages ?? 0);
    const otherCosts = Number(original?.other_costs ?? 0);
    const grossProfit = netSales - materialCost;
    return {
      period,
      net_sales: netSales.toFixed(2),
      material_cost: materialCost.toFixed(2),
      missing_material_cost_count: periodMissing.get(period) ?? 0,
      gross_profit: grossProfit.toFixed(2),
      wages: wages.toFixed(2),
      other_costs: otherCosts.toFixed(2),
      operating_profit: (grossProfit - wages - otherCosts).toFixed(2),
    };
  });

  const totalWages = Number(base.kpis.wages);
  const totalOther = Number(base.kpis.other_costs);
  const grossProfit = totalSales - totalMaterial;
  const operatingProfit = grossProfit - totalWages - totalOther;
  const products: ProfitabilityAnalysis["products"] = [...productGroups.entries()].map(([productId, items]) => {
    const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const netSales = items.reduce((sum, item) => sum + Number(item.net_sales_amount), 0);
    const unitCost = unitCosts.get(productId) ?? null;
    const materialCost = unitCost === null ? 0 : unitCost * quantity;
    const contribution = netSales - materialCost;
    return {
      product_id: productId,
      product_name_zh: items[0].product_name_zh,
      product_name_en: items[0].product_name_en,
      quantity,
      net_sales: netSales.toFixed(2),
      material_cost: materialCost.toFixed(2),
      missing_material_cost_count: unitCost === null ? items.length : 0,
      material_cost_complete: unitCost !== null,
      contribution_profit: contribution.toFixed(2),
      contribution_margin: (netSales ? contribution / netSales * 100 : 0).toFixed(1),
      contribution_share: "0.0",
      quadrant: "REVIEW" as const,
    };
  }).sort((left, right) => Number(right.net_sales) - Number(left.net_sales));

  for (const product of products) {
    product.contribution_share = (grossProfit ? Number(product.contribution_profit) / grossProfit * 100 : 0).toFixed(1);
  }
  const salesMedian = median(products.map((product) => Number(product.net_sales)));
  const marginMedian = median(products.map((product) => Number(product.contribution_margin)));
  for (const product of products) {
    const highSales = Number(product.net_sales) >= salesMedian;
    const highMargin = Number(product.contribution_margin) >= marginMedian;
    product.quadrant = highSales && highMargin ? "STAR" : !highSales && highMargin ? "POTENTIAL" : highSales ? "TRAFFIC" : "REVIEW";
  }

  return {
    range: { start, end, grain },
    kpis: {
      net_sales: totalSales.toFixed(2),
      material_cost: totalMaterial.toFixed(2),
      missing_material_cost_count: missingMaterialCostCount,
      material_cost_complete: missingMaterialCostCount === 0,
      gross_profit: grossProfit.toFixed(2),
      gross_margin: (totalSales ? grossProfit / totalSales * 100 : 0).toFixed(1),
      wages: totalWages.toFixed(2),
      other_costs: totalOther.toFixed(2),
      operating_profit: operatingProfit.toFixed(2),
      operating_margin: (totalSales ? operatingProfit / totalSales * 100 : 0).toFixed(1),
    },
    cost_structure: [
      { key: "MATERIALS", amount: totalMaterial.toFixed(2) },
      { key: "WAGES", amount: totalWages.toFixed(2) },
      { key: "OTHER", amount: totalOther.toFixed(2) },
    ],
    trend,
    products,
  };
}

function localProfitabilityPeriod(value: string, grain: ProfitabilityAnalysisGrain) {
  if (grain === "day") return value;
  if (grain === "month") return `${value.slice(0, 7)}-01`;
  const monday = new Date(`${value}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
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

export async function getActiveScheduleEmployees() {
  if (getDataMode() === "TEST") {
    const today = new Date();
    const todayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    return (await getEmployees("", "ACTIVE", false))
      .filter((employee) => !employee.hire_date || employee.hire_date <= todayKey)
      .map(({ id, name, position }) => ({ id, name, position }));
  }
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

function inventoryReceiptFormData(input: InventoryReceiptInput) {
  const form = new FormData();
  const fields = {
    ingredient_id: input.ingredient_id,
    supplier_id: input.supplier_id,
    quantity: input.quantity,
    unit: input.unit,
    unit_price: input.unit_price,
    received_at: input.received_at,
    notes: input.notes,
    recorded_by_id: input.recorded_by_id,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) form.set(key, value);
  }
  if (input.invoice) form.set("invoice", input.invoice);
  if (input.remove_invoice) form.set("remove_invoice", "true");
  if (input.ingredient_name) form.set("_local_ingredient_name", input.ingredient_name);
  if (input.supplier_name) form.set("_local_supplier_name", input.supplier_name);
  if (input.recorded_by_name) form.set("_local_recorded_by_name", input.recorded_by_name);
  if (input.currency) form.set("_local_currency", input.currency);
  if (input.price_unit) form.set("_local_price_unit", input.price_unit);
  return form;
}

export function createInventoryReceipt(input: InventoryReceiptInput & { ingredient_id: string }) {
  return apiRequest<InventoryReceipt>("/inventory/receipts/", {
    method: "POST",
    body: inventoryReceiptFormData(input),
  });
}

export function updateInventoryReceipt(receiptId: string, input: InventoryReceiptInput) {
  return apiRequest<InventoryReceipt>(`/inventory/receipts/${receiptId}/`, {
    method: "PATCH",
    body: inventoryReceiptFormData(input),
  });
}

export function deleteInventoryReceipt(receiptId: string) {
  return apiRequest<void>(`/inventory/receipts/${receiptId}/`, {
    method: "DELETE",
  });
}

export async function bulkDeleteInventoryReceipts(receiptIds: string[]) {
  if (getDataMode() === "TEST") {
    for (const receiptId of receiptIds) {
      await deleteInventoryReceipt(receiptId);
    }
    return;
  }
  return apiRequest<void>("/inventory/receipts/bulk-delete/", {
    method: "POST",
    body: JSON.stringify({ receipt_ids: receiptIds }),
  });
}

export function getInventoryRecorderOptions() {
  return apiRequest<InventoryRecorderOption[]>("/inventory/receipts/recorder-options/");
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

export function deleteSupplier(supplierId: string) {
  return apiRequest<void>(`/suppliers/${supplierId}/`, { method: "DELETE" });
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

export function deleteSupplierIngredient(itemId: string) {
  return apiRequest<void>(`/suppliers/ingredients/${itemId}/`, {
    method: "DELETE",
  });
}
