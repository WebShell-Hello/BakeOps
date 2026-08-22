import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourcePath = process.argv[2];
const outputDirectory = resolve(
  process.argv[3] ?? "frontend/src/data/test",
);

if (!sourcePath) {
  throw new Error(
    "Usage: node scripts/materialize-test-data.mjs <browser-export.json> [output-directory]",
  );
}

const exported = JSON.parse(await readFile(resolve(sourcePath), "utf8"));
if (exported.version !== 1 || !Array.isArray(exported.responses) || !Array.isArray(exported.mutations)) {
  throw new Error("The input is not a BakeOps test-data export (version 1)." );
}

const responses = new Map(exported.responses.map(({ key, value }) => [key, value]));
const required = (key) => {
  if (!responses.has(key)) throw new Error(`Missing required response: ${key}`);
  return responses.get(key);
};
const uniqueById = (items) => [
  ...new Map(items.filter((item) => item?.id).map((item) => [item.id, item])).values(),
];
const save = async (name, value) => {
  await writeFile(
    resolve(outputDirectory, name),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
};

const products = required("BASE:/products/");
const ingredients = required("BASE:/suppliers/ingredient-options/");
const suppliers = required("BASE:/suppliers/");
const inventoryOverview = required("BASE:/inventory/overview/");
const receipts = required("BASE:/inventory/receipts/");
const eventOverview = required("BASE:/events/overview/?year=2026");
const monthlyCosts = required("BASE:/costs/monthly-items/?month=2026-08");
const dashboard = required("BASE:/dashboard/overview/?date=2026-08-22");

const recipes = products.flatMap((product) => product.active_recipe
  ? [{
      id: product.active_recipe.id,
      product_id: product.id,
      version: product.active_recipe.version,
      yield_quantity: product.active_recipe.yield_quantity,
      yield_unit: product.active_recipe.yield_unit,
      production_description: product.active_recipe.production_description,
      total_weight: product.active_recipe.total_weight,
      is_active: true,
    }]
  : []);
const recipeSections = products.flatMap((product) =>
  (product.active_recipe?.sections ?? []).map((section) => ({
    id: section.id,
    recipe_id: product.active_recipe.id,
    name: section.name,
    position: section.position,
  })),
);
const recipeIngredients = products.flatMap((product) =>
  (product.active_recipe?.sections ?? []).flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      recipe_id: product.active_recipe.id,
      product_id: product.id,
    }))),
);
const supplierIngredients = suppliers.flatMap((supplier) =>
  supplier.supplied_ingredients.map((item) => ({ ...item, supplier_id: supplier.id })),
);
const productionPlanResponses = exported.responses
  .filter(({ key }) => key.startsWith("BASE:/inventory/production-plans/"))
  .map(({ value }) => value);
const productionPlans = uniqueById(productionPlanResponses.flatMap(({ plans }) => plans));
const productionPlanProducts = uniqueById(
  productionPlanResponses.flatMap(({ product_options: options }) => options),
);
const businessEventFocusProducts = eventOverview.events.flatMap((event) =>
  event.focus_products.map((product) => ({ business_event_id: event.id, product_id: product.id })),
);
const eventChecklistItems = eventOverview.events.flatMap((event) =>
  event.checklist_items.map((item) => ({ ...item, business_event_id: event.id })),
);
const costItems = uniqueById(monthlyCosts
  .filter((item) => item.cost_item)
  .map((item) => ({
    id: item.cost_item,
    name_zh: item.cost_item_name_zh || item.name_zh,
    name_en: item.cost_item_name_en || item.name_en,
    category: item.category,
    is_active: true,
    notes: item.notes ?? "",
  })));
const costMonths = [...new Set(monthlyCosts.map((item) => item.cost_month))]
  .sort()
  .map((month) => ({ month }));
const salesData = uniqueById(exported.mutations
  .filter(({ root, method, value }) => root === "/sales/data/" && method === "POST" && value)
  .map(({ value }) => value));
const profitabilityBaselines = exported.responses
  .filter(({ key }) => key.startsWith("BASE:/sales/profitability/"))
  .map(({ key, value }) => ({ key, value }));
const activityCategories = [
  { id: "a1000000-0000-4000-8000-000000000001", code: "SOCIAL", name_zh: "社交媒体", name_en: "Social media", colour: "rose", icon_key: "messages-square", position: 10 },
  { id: "a1000000-0000-4000-8000-000000000002", code: "DELIVERY", name_zh: "外卖平台", name_en: "Delivery platform", colour: "blue", icon_key: "bike", position: 20 },
  { id: "a1000000-0000-4000-8000-000000000003", code: "IN_STORE", name_zh: "现场推广", name_en: "In-store promotion", colour: "amber", icon_key: "store", position: 30 },
  { id: "a1000000-0000-4000-8000-000000000004", code: "INFLUENCER", name_zh: "网红合作", name_en: "Influencer", colour: "violet", icon_key: "sparkles", position: 40 },
  { id: "a1000000-0000-4000-8000-000000000005", code: "OTHER", name_zh: "其他", name_en: "Other", colour: "green", icon_key: "megaphone", position: 90 },
];
const activityPlatforms = [
  ["b1000000-0000-4000-8000-000000000001", 0, "INSTAGRAM", "Instagram", "Instagram", 10],
  ["b1000000-0000-4000-8000-000000000002", 0, "XIAOHONGSHU", "小红书", "Xiaohongshu", 20],
  ["b1000000-0000-4000-8000-000000000003", 0, "TIKTOK", "TikTok", "TikTok", 30],
  ["b1000000-0000-4000-8000-000000000004", 1, "DELIVEROO", "Deliveroo", "Deliveroo", 10],
  ["b1000000-0000-4000-8000-000000000005", 1, "HUNGRYPANDA", "熊猫外卖", "HungryPanda", 20],
  ["b1000000-0000-4000-8000-000000000006", 1, "UBEREATS", "Uber Eats", "Uber Eats", 30],
  ["b1000000-0000-4000-8000-000000000007", 2, "POSTER", "现场海报", "In-store poster", 10],
  ["b1000000-0000-4000-8000-000000000008", 3, "KOL", "网红代言", "KOL endorsement", 10],
  ["b1000000-0000-4000-8000-000000000009", 4, "OTHER", "其他平台", "Other platform", 10],
].map(([id, categoryIndex, code, name_zh, name_en, position]) => ({ id, category_id: activityCategories[categoryIndex].id, code, name_zh, name_en, position }));
const activityPlanSpecs = [
  ["c1000000-0000-4000-8000-000000000001", "每周发布小红书动态", 0, 1, "WEEKLY", "10:00", [1, 4], []],
  ["c1000000-0000-4000-8000-000000000002", "检查 Deliveroo 门店内容", 1, 3, "DAILY", "09:30", [], []],
  ["c1000000-0000-4000-8000-000000000003", "更新门店活动海报", 2, 6, "MONTHLY", "11:00", [], [1, 15]],
];
const activityReminderRules = activityPlanSpecs.map(([planId, , , , frequency, reminderTime, weekdays, monthDays], index) => ({ id: `c2000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, plan_id: planId, frequency, interval: 1, weekdays, month_days: monthDays, reminder_time: reminderTime, timezone: "Europe/London", is_enabled: true }));
const activityPlans = activityPlanSpecs.map(([id, name, categoryIndex, platformIndex], index) => ({ id, name, category_id: activityCategories[categoryIndex].id, platform_id: activityPlatforms[platformIndex].id, description: "", priority: index === 1 ? "HIGH" : "NORMAL", status: "ACTIVE", start_date: "2026-08-01", end_date: null, owner_id: null, owner_name: "", focus_product_ids: [], reminder_rule_id: activityReminderRules[index].id, next_reminder_at: null, created_at: exported.exportedAt, updated_at: exported.exportedAt }));

await mkdir(outputDirectory, { recursive: true });
const employeesBaseline = JSON.parse(await readFile(resolve(outputDirectory, "employees.json"), "utf8"));
const schedulesBaseline = JSON.parse(await readFile(resolve(outputDirectory, "schedules.json"), "utf8"));
const tableManifest = [
  ["costs_costitem", "cost-items.json", costItems.length],
  ["costs_costmonth", "cost-months.json", costMonths.length],
  ["costs_monthlycost", "monthly-costs.json", monthlyCosts.length],
  ["employees_employee", "employees.json", employeesBaseline.length],
  ["events_activitycategory", "activity-categories.json", activityCategories.length],
  ["events_activityplatform", "activity-platforms.json", activityPlatforms.length],
  ["events_activityplan", "activity-plans.json", activityPlans.length],
  ["events_activityplan_focus_products", "activity-plan-focus-products.json", 0],
  ["events_activityreminderrule", "activity-reminder-rules.json", activityReminderRules.length],
  ["events_activityreminderoccurrence", "activity-reminder-occurrences.json", 0],
  ["events_businessclosure", "business-closures.json", eventOverview.closures.length],
  ["events_businessevent", "business-events.json", eventOverview.events.length],
  ["events_businessevent_focus_products", "business-event-focus-products.json", businessEventFocusProducts.length],
  ["events_eventchecklistitem", "event-checklist-items.json", eventChecklistItems.length],
  ["events_holiday", "holidays.json", eventOverview.holidays.length],
  ["inventory_inventoryitem", "inventory-items.json", inventoryOverview.items.length],
  ["inventory_inventoryreceipt", "inventory-receipts.json", receipts.length],
  ["inventory_productionplan", "production-plans.json", productionPlans.length],
  ["inventory_purchaserequest", "purchase-requests.json", 0],
  ["products_ingredient", "ingredients.json", ingredients.length],
  ["products_product", "products.json", products.length],
  ["products_recipe", "recipes.json", recipes.length],
  ["products_recipeingredient", "recipe-ingredients.json", recipeIngredients.length],
  ["products_recipesection", "recipe-sections.json", recipeSections.length],
  ["sales_salesdatarecord", "sales-data.json", salesData.length],
  ["sales_salesorder", "sales-orders.json", 0],
  ["sales_salesorderline", "sales-order-lines.json", 0],
  ["scheduling_scheduleentry", "schedules.json", schedulesBaseline.length],
  ["suppliers_supplier", "suppliers.json", suppliers.length],
  ["suppliers_supplieringredient", "supplier-ingredients.json", supplierIngredients.length],
].map(([table, file, rows]) => ({ table, file, rows }));
await Promise.all([
  save("products.json", products),
  save("ingredients.json", ingredients),
  save("recipes.json", recipes),
  save("recipe-sections.json", recipeSections),
  save("recipe-ingredients.json", recipeIngredients),
  save("suppliers.json", suppliers),
  save("supplier-ingredients.json", supplierIngredients),
  save("inventory-items.json", inventoryOverview.items),
  save("inventory-overview.json", inventoryOverview),
  save("inventory-receipts.json", receipts),
  save("purchase-requests.json", []),
  save("production-plans.json", productionPlans),
  save("production-plan-products.json", productionPlanProducts),
  save("cost-items.json", costItems),
  save("cost-months.json", costMonths),
  save("monthly-costs.json", monthlyCosts),
  save("holidays.json", eventOverview.holidays),
  save("business-events.json", eventOverview.events),
  save("business-event-focus-products.json", businessEventFocusProducts),
  save("event-checklist-items.json", eventChecklistItems),
  save("business-closures.json", eventOverview.closures),
  save("sales-data.json", salesData),
  save("sales-orders.json", []),
  save("sales-order-lines.json", []),
  save("dashboard.json", dashboard),
  save("profitability-baselines.json", profitabilityBaselines),
  save("activity-categories.json", activityCategories),
  save("activity-platforms.json", activityPlatforms),
  save("activity-plans.json", activityPlans),
  save("activity-plan-focus-products.json", []),
  save("activity-reminder-rules.json", activityReminderRules),
  save("activity-reminder-occurrences.json", []),
  save("manifest.json", tableManifest),
]);

console.log(`Materialized ${salesData.length} sales rows and ${products.length} products in ${outputDirectory}`);
