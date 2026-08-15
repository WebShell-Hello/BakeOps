"use client";

import { Children, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calculator,
  CalendarDays,
  ChefHat,
  CheckCircle2,
  ExternalLink,
  PackageSearch,
  PoundSterling,
  RefreshCw,
  ShoppingBag,
  Target,
  TrendingUp,
} from "lucide-react";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BAKEOPS_DATA_CHANGE_EVENT, getDashboardOverview, type DashboardOverview } from "@/lib/api";

const metricDefinitions = [
  { key: "sales", icon: PoundSterling, tone: "blue" as const },
  { key: "cost", icon: Calculator, tone: "violet" as const },
  { key: "orders", icon: ShoppingBag, tone: "blue" as const },
  { key: "planned", icon: ChefHat, tone: "amber" as const },
  { key: "actual", icon: CheckCircle2, tone: "green" as const },
] as const;

const chartColors = ["#0a2535", "#fe6844", "#e3c900", "#378fb8", "#38a169", "#8b5cf6"];

const copy = {
  "zh-CN": {
    overview: "概览", description: "从销售、生产、库存和活动风险快速掌握门店运营状况", refresh: "刷新", refreshPage: "刷新仪表盘",
    selectDate: "选择仪表盘日期", coreMetrics: "核心指标", sales: "净销售", ordersLabel: "订单", planned: "计划生产", actualLabel: "实际生产", cost: "成本预估",
    soldItems: (n: number) => `已售 ${n.toLocaleString("zh-CN")} 件`, orders: (n: number) => `${n.toLocaleString("zh-CN")} 笔订单`, plannedDescription: "计划制作总量", completion: (rate: string) => `计划完成率 ${rate}%`, costParts: (materials: string, labour: string) => `物料 ${materials} · 人工 ${labour}`, costIncomplete: (n: number) => `${n} 项生产记录缺少成本`,
    trend: "销售趋势", lastSeven: "截至所选日期的 7 天", revenue: "净销售", ordersCount: "订单数", mix: "销售结构", other: "其他产品", noSales: "该 7 天区间暂无销售", noMix: "暂无销售结构数据",
    products: "热销产品 TOP 5", quantity: "销量", netSales: "净销售", noProducts: "暂无产品销售数据", inventoryRisks: "库存风险", noInventoryRisks: "当前没有库存风险", eventsRisk: "活动准备风险", noEventRisks: "当前没有活动准备风险", viewAll: "查看全部", shortage: "预计不足", days: "天后开始", preparation: "准备进度", noDate: "未计算",
    inventoryStatus: { EMERGENCY: "紧急", PURCHASE_REQUIRED: "需要采购", WATCH: "关注" },
  },
  "en-GB": {
    overview: "Overview", description: "A live view of sales, production, inventory and event risks", refresh: "Refresh", refreshPage: "Refresh dashboard",
    selectDate: "Select dashboard date", coreMetrics: "Core metrics", sales: "Net sales", ordersLabel: "Orders", planned: "Planned production", actualLabel: "Actual production", cost: "Estimated cost",
    soldItems: (n: number) => `${n.toLocaleString("en-GB")} items sold`, orders: (n: number) => `${n.toLocaleString("en-GB")} orders`, plannedDescription: "Total planned output", completion: (rate: string) => `${rate}% of plan completed`, costParts: (materials: string, labour: string) => `Materials ${materials} · Labour ${labour}`, costIncomplete: (n: number) => `${n} production records lack costs`,
    trend: "Sales trend", lastSeven: "7 days ending on selected date", revenue: "Net sales", ordersCount: "Orders", mix: "Sales mix", other: "Other products", noSales: "No sales in this 7-day period", noMix: "No sales mix data yet",
    products: "Top 5 products", quantity: "Quantity", netSales: "Net sales", noProducts: "No product sales data yet", inventoryRisks: "Inventory risks", noInventoryRisks: "No inventory risks", eventsRisk: "Event preparation risks", noEventRisks: "No event preparation risks", viewAll: "View all", shortage: "Shortage", days: "days to start", preparation: "Preparation", noDate: "Not calculated",
    inventoryStatus: { EMERGENCY: "Emergency", PURCHASE_REQUIRED: "Purchase required", WATCH: "Watch" },
  },
} as const;

export function DashboardPage() {
  const { locale } = useAppPreferences();
  const text = copy[locale];
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => localDateValue(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await getDashboardOverview(selectedDate));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const refresh = () => void load();
    window.addEventListener(BAKEOPS_DATA_CHANGE_EVENT, refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener(BAKEOPS_DATA_CHANGE_EVENT, refresh); };
  }, [load]);

  const formatCurrency = useCallback((value: string | number) => new Intl.NumberFormat(locale, { style: "currency", currency: "GBP" }).format(Number(value)), [locale]);
  const formatDate = useCallback((value: string, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options ?? { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`)), [locale]);
  const chartData = useMemo(() => overview?.sales_trend.map((item) => ({ ...item, label: formatDate(item.date, { day: "2-digit", month: "short" }), amount: Number(item.net_sales) })) ?? [], [formatDate, overview]);
  const metrics = overview?.kpis;
  const selectDate = (value: string) => { if (value && value !== selectedDate) setSelectedDate(value); };

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div><PageBreadcrumb fallback={{ zh: text.overview, en: text.overview }} /><p className="mt-1.5 text-sm text-[var(--muted)]">{text.description}</p></div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex h-10 w-[170px] items-center gap-2 rounded-lg bg-transparent px-2 text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] focus-within:bg-[var(--surface-muted)] focus-within:ring-2 focus-within:ring-[var(--primary-ring)]">
              <CalendarDays className="size-4 shrink-0" />
              <input aria-label={text.selectDate} type="date" value={selectedDate} className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium tabular-nums text-[var(--foreground)] outline-none" onChange={(event) => selectDate(event.target.value)} onBlur={(event) => selectDate(event.target.value)} />
            </label>
            <Button variant="outline" aria-label={text.refreshPage} onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />{text.refresh}</Button>
          </div>
        </header>

        {error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{locale === "zh-CN" ? "仪表盘数据暂时无法加载，请刷新重试。" : "Dashboard data is unavailable. Please refresh and try again."}</div>}

        <section aria-label={text.coreMetrics} className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {metricDefinitions.map((metric) => {
            const dailyCost = metrics?.daily_estimated_cost;
            const completionRate = metrics?.today_planned_production ? (metrics.today_actual_production / metrics.today_planned_production * 100).toFixed(1) : "0.0";
            const value = !metrics ? "—" : metric.key === "sales" ? formatCurrency(metrics.today_net_sales) : metric.key === "cost" ? dailyCost?.total ? formatCurrency(dailyCost.total) : "—" : metric.key === "orders" ? metrics.today_order_count.toLocaleString(locale) : metric.key === "planned" ? metrics.today_planned_production.toLocaleString(locale) : metrics.today_actual_production.toLocaleString(locale);
            const description = !metrics ? "—" : metric.key === "sales" ? text.soldItems(metrics.today_sales_quantity) : metric.key === "cost" ? dailyCost?.calculation_complete ? text.costParts(formatCurrency(dailyCost.material_cost), formatCurrency(dailyCost.labour_cost)) : text.costIncomplete(dailyCost?.missing_cost_count ?? 0) : metric.key === "orders" ? text.orders(metrics.today_order_count) : metric.key === "planned" ? text.plannedDescription : text.completion(completionRate);
            const label = metric.key === "sales" ? text.sales : metric.key === "cost" ? text.cost : metric.key === "orders" ? text.ordersLabel : metric.key === "planned" ? text.planned : text.actualLabel;
            return <MetricCard key={metric.key} icon={metric.icon} tone={metric.tone} label={label} value={value} description={description} />;
          })}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,1fr)]">
          <Card><CardHeader><CardTitle>{text.trend}</CardTitle><span className="text-xs text-[var(--muted)]">{text.lastSeven}</span></CardHeader><CardContent className="pt-3"><div className="h-[280px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}><XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} axisLine={false} tickLine={false} width={52} /><Tooltip formatter={(value) => [formatCurrency(Number(value)), text.revenue]} /><Line type="monotone" dataKey="amount" stroke="#fe6844" strokeWidth={3} dot={{ r: 3, fill: "#fe6844" }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div>{!loading && chartData.every((item) => item.amount === 0) && <p className="mt-2 text-center text-sm text-[var(--muted)]">{text.noSales}</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle>{text.mix}</CardTitle><span className="text-xs text-[var(--muted)]">{text.lastSeven}</span></CardHeader><CardContent className="pt-3"><div className="grid gap-4 sm:grid-cols-[160px_1fr] sm:items-center"><div className="h-[190px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={overview?.sales_mix ?? []} dataKey="net_sales" nameKey="product_name_en" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="transparent">{(overview?.sales_mix ?? []).map((item, index) => <Cell key={`${item.product_id ?? "other"}-${index}`} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => [formatCurrency(Number(value)), text.netSales]} /></PieChart></ResponsiveContainer></div><div className="space-y-2.5">{(overview?.sales_mix ?? []).map((item, index) => <div key={`${item.product_id ?? "other"}-legend`} className="flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} /><span className="truncate">{locale === "en-GB" ? item.product_name_en : item.product_name_zh}</span></span><span className="shrink-0 tabular-nums text-[var(--muted)]">{item.share}%</span></div>)}{!loading && !overview?.sales_mix.length && <p className="text-sm text-[var(--muted)]">{text.noMix}</p>}</div></div></CardContent></Card>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <DashboardListCard title={text.products} icon={PackageSearch} empty={text.noProducts}>{overview?.top_products.map((item, index) => <Link key={item.product_id} href={`/products/product-recipes?search=${encodeURIComponent(item.product_name_zh)}`} className="flex items-center gap-3 border-b border-[var(--border)] py-3 last:border-0 hover:text-[var(--primary)]"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] text-xs font-semibold">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{locale === "en-GB" ? item.product_name_en : item.product_name_zh}</span><span className="shrink-0 text-right text-xs text-[var(--muted)]"><strong className="block text-sm tabular-nums text-[var(--foreground)]">{item.quantity.toLocaleString(locale)}</strong>{formatCurrency(item.net_sales)}</span></Link>)}</DashboardListCard>
          <DashboardListCard title={text.inventoryRisks} icon={AlertTriangle} href="/operations/inventory" empty={text.noInventoryRisks}>{overview?.inventory_risks.slice(0, 6).map((item) => <Link key={item.ingredient_id} href={`/operations/inventory?ingredient=${item.ingredient_id}`} className="flex items-center gap-3 border-b border-[var(--border)] py-3 last:border-0 hover:text-[var(--primary)]"><span className={`size-2.5 shrink-0 rounded-full ${item.status === "EMERGENCY" ? "bg-rose-500" : item.status === "PURCHASE_REQUIRED" ? "bg-orange-500" : "bg-amber-400"}`} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{item.ingredient_name}</span><span className="shrink-0 text-right text-xs"><strong className="block font-medium">{text.inventoryStatus[item.status]}</strong><span className="text-[var(--muted)]">{item.current_stock} {item.unit} · {item.shortage_date ? `${text.shortage} ${formatDate(item.shortage_date)}` : text.noDate}</span></span></Link>)}</DashboardListCard>
          <DashboardListCard title={text.eventsRisk} icon={Target} href="/planning/calendar-events" empty={text.noEventRisks}>{overview?.event_risks.map((item) => <Link key={item.id} href={`/planning/calendar-events?event=${item.id}`} className="block border-b border-[var(--border)] py-3 last:border-0 hover:text-[var(--primary)]"><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-medium">{item.name}</span><span className="shrink-0 text-xs text-rose-600">{item.days_until_start} {text.days}</span></div><div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]"><span>{formatDate(item.start_date)}</span><span>·</span><span>{text.preparation} {item.checklist_completed}/{item.checklist_total}</span></div></Link>)}</DashboardListCard>
        </section>
      </main>
    </DashboardShell>
  );
}

function DashboardListCard({ title, icon: Icon, href, empty, children }: { title: string; icon: typeof PackageSearch; href?: string; empty: string; children?: React.ReactNode }) {
  const hasChildren = Children.count(children) > 0;
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Icon className="size-4 text-[var(--primary)]" />{title}</CardTitle>{href && <Link href={href} aria-label={title} className="text-[var(--muted)] hover:text-[var(--primary)]"><ExternalLink className="size-4" /></Link>}</CardHeader><CardContent className="pt-2">{hasChildren ? children : <div className="grid min-h-36 place-items-center text-center text-sm text-[var(--muted)]"><TrendingUp className="mb-2 size-5" />{empty}</div>}</CardContent></Card>;
}

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
