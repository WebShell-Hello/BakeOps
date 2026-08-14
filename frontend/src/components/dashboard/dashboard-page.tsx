"use client";

import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Database,
  PackageSearch,
  PoundSterling,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type HealthStatus } from "@/lib/api";

const metricDefinitions = [
  { key: "sales", icon: PoundSterling, tone: "blue" as const },
  { key: "orders", icon: ShoppingBag, tone: "green" as const },
  { key: "production", icon: ChefHat, tone: "amber" as const },
  { key: "inventory", icon: Boxes, tone: "violet" as const },
  { key: "waste", icon: Trash2, tone: "rose" as const },
] as const;

const copy = {
  "zh-CN": {
    overview: "概览",
    overviewDescription: "全局数据概览，掌握 BakeOps 门店运营状况",
    refresh: "刷新",
    refreshPage: "刷新页面",
    coreMetrics: "核心指标",
    awaitingData: "等待业务数据",
    metrics: { sales: "今日销售额", orders: "今日订单", production: "计划产量", inventory: "低库存原料", waste: "今日损耗" },
    salesTrend: "销售趋势",
    lastSevenDays: "最近 7 天",
    noSalesTrend: "暂无销售趋势",
    salesTrendDescription: "订单功能接入后，图表将通过 Analytics API 展示真实销售数据。",
    salesMix: "销售结构",
    noCategoryData: "暂无品类数据",
    categoryDescription: "产品与订单数据准备后自动显示。",
    topProducts: "热销产品 TOP 5",
    noProductRanking: "尚无产品排名",
    productRankingDescription: "等待产品和订单业务数据。",
    expiringInventory: "即将到期库存",
    noInventoryBatches: "尚无库存批次",
    inventoryDescription: "库存批次接入后，这里将展示临期原材料。",
    systemStatus: "系统状态",
    live: "实时",
    frontend: "Next.js 前端",
    frontendHealthy: "管理界面运行正常",
    apiHealthy: "API 服务连接正常",
    apiUnavailable: "API 服务不可用",
    databaseHealthy: "数据库连接正常",
    databaseUnavailable: "数据库连接不可用",
  },
  "en-GB": {
    overview: "Overview",
    overviewDescription: "A complete view of your BakeOps store operations",
    refresh: "Refresh",
    refreshPage: "Refresh page",
    coreMetrics: "Core metrics",
    awaitingData: "Awaiting business data",
    metrics: { sales: "Today's sales", orders: "Today's orders", production: "Planned production", inventory: "Low-stock ingredients", waste: "Today's waste" },
    salesTrend: "Sales trend",
    lastSevenDays: "Last 7 days",
    noSalesTrend: "No sales trend yet",
    salesTrendDescription: "Once orders are available, the chart will display live sales data from the Analytics API.",
    salesMix: "Sales mix",
    noCategoryData: "No category data yet",
    categoryDescription: "This will appear automatically when product and order data is available.",
    topProducts: "Top 5 products",
    noProductRanking: "No product ranking yet",
    productRankingDescription: "Waiting for product and order data.",
    expiringInventory: "Expiring inventory",
    noInventoryBatches: "No inventory batches yet",
    inventoryDescription: "Expiring ingredients will appear here when inventory batches are connected.",
    systemStatus: "System status",
    live: "Live",
    frontend: "Next.js frontend",
    frontendHealthy: "Management interface is operating normally",
    apiHealthy: "API service connected",
    apiUnavailable: "API service unavailable",
    databaseHealthy: "Database connected",
    databaseUnavailable: "Database unavailable",
  },
} as const;

export function DashboardPage({ health, nowIso }: { health: HealthStatus; nowIso: string }) {
  const { locale } = useAppPreferences();
  const text = copy[locale];
  const today = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(nowIso));

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <PageBreadcrumb fallback={{ zh: text.overview, en: text.overview }} />
            <p className="mt-1.5 text-sm text-[var(--muted)]">{text.overviewDescription}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="justify-start font-normal text-[var(--muted)]">
              <CalendarDays className="size-4" />
              {today}
            </Button>
            <Button variant="outline" aria-label={text.refreshPage} onClick={undefined}>
              <RefreshCw className="size-4" />
              {text.refresh}
            </Button>
          </div>
        </header>

        <section aria-label={text.coreMetrics} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {metricDefinitions.map((metric) => (
            <MetricCard
              key={metric.key}
              icon={metric.icon}
              tone={metric.tone}
              label={text.metrics[metric.key]}
              emptyLabel={text.awaitingData}
            />
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{text.salesTrend}</CardTitle>
              <span className="text-xs text-[var(--muted)]">{text.lastSevenDays}</span>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="chart-grid rounded-xl border border-dashed border-[var(--border)]">
                <EmptyState icon={TrendingUp} title={text.noSalesTrend} description={text.salesTrendDescription} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{text.salesMix}</CardTitle>
              <Sparkles className="size-4 text-[var(--muted)]" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="relative mx-auto grid min-h-[250px] max-w-[350px] place-items-center">
                <div className="absolute size-44 rounded-full border-[30px] border-[var(--surface-muted)]" />
                <EmptyState icon={BarChart3} title={text.noCategoryData} description={text.categoryDescription} />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>{text.topProducts}</CardTitle></CardHeader>
            <CardContent className="pt-2">
              <EmptyState icon={PackageSearch} title={text.noProductRanking} description={text.productRankingDescription} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{text.expiringInventory}</CardTitle></CardHeader>
            <CardContent className="pt-2">
              <EmptyState icon={AlertTriangle} title={text.noInventoryBatches} description={text.inventoryDescription} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{text.systemStatus}</CardTitle>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {text.live}
              </span>
            </CardHeader>
            <CardContent className="space-y-1 pt-3">
              <SystemStatusRow icon={CheckCircle2} label={text.frontend} description={text.frontendHealthy} available />
              <SystemStatusRow
                icon={ClipboardList}
                label="Django REST API"
                description={health.status === "ok" ? text.apiHealthy : text.apiUnavailable}
                available={health.status === "ok"}
              />
              <SystemStatusRow
                icon={Database}
                label="PostgreSQL"
                description={health.database === "connected" ? text.databaseHealthy : text.databaseUnavailable}
                available={health.database === "connected"}
              />
            </CardContent>
          </Card>
        </section>
      </main>
    </DashboardShell>
  );
}

function SystemStatusRow({
  icon: Icon,
  label,
  description,
  available,
}: {
  icon: typeof CheckCircle2;
  label: string;
  description: string;
  available: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)] py-3.5 last:border-0">
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-full ${
          available ? "bg-[var(--success-soft)] text-emerald-500" : "bg-[var(--danger-soft)] text-rose-500"
        }`}
      >
        <Icon className="size-[17px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{description}</p>
      </div>
      <span className={`size-2 rounded-full ${available ? "bg-emerald-500" : "bg-rose-500"}`} />
    </div>
  );
}
