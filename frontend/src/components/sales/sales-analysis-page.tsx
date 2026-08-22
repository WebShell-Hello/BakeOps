"use client";

import {
  differenceInCalendarDays,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import { enGB, zhCN } from "date-fns/locale";
import {
  BadgePercent,
  CalendarRange,
  ChartLine,
  List,
  PoundSterling,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataPagination, useDataPagination } from "@/components/ui/data-pagination";
import {
  PeriodRangeToolbar,
  periodRange,
  shiftPeriodCursor,
  type PeriodUnit,
} from "@/components/ui/period-range-toolbar";
import {
  getSalesAnalysis,
  type SalesAnalysis,
  type SalesAnalysisGrain,
  type SalesChannel,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type TrendMode = "chart" | "list";
const salesChannels: SalesChannel[] = ["DIRECT", "CONSIGNMENT", "DELIVERY"];

const copy = {
  "zh-CN": {
    title: "销售分析",
    description: "基于每日各渠道、各产品汇总数据分析销量、成交价格、折扣和退款",
    netSales: "净销售收入",
    salesQuantity: "销售数量",
    orders: "订单数",
    averageOrder: "平均客单价",
    discount: "折扣金额",
    refunds: "退款金额",
    units: "件",
    day: "日",
    week: "周",
    month: "月",
    startDate: "开始日期",
    endDate: "结束日期",
    refresh: "刷新数据",
    trendTitle: "收入趋势",
    trendDescription: "实际支付金额扣除退款后的净销售收入",
    chartMode: "图表模式",
    listMode: "列表模式",
    dailySalesTitle: "每日销售明细",
    salesDate: "销售日期",
    averageOrderValue: "平均客单价",
    hourlyTitle: "营业时段表现",
    hourlyDescription: "按订单成交时间汇总净销售收入",
    productTitle: "产品实际销售",
    product: "产品",
    quantity: "销售数量",
    standardSales: "标准销售额",
    productDiscount: "折扣",
    productRefunds: "退款",
    actualNetSales: "实际净收入",
    standardPrice: "标准售价",
    actualAveragePrice: "实际平均售价",
    realisation: "价格实现率",
    loading: "正在读取销售数据...",
    empty: "当前日期范围没有销售数据",
    loadError: "销售分析加载失败",
    netSalesLabel: "净销售收入",
    periodSummary: "汇总",
    channel: "销售渠道",
    allChannels: "全部渠道",
    channelNames: { DIRECT: "现场直销", CONSIGNMENT: "喜家代销", DELIVERY: "外卖平台" },
  },
  "en-GB": {
    title: "Sales Analysis",
    description: "Analyse quantity, realised prices, discounts and refunds from daily channel and product totals",
    netSales: "Net sales revenue",
    salesQuantity: "Units sold",
    orders: "Orders",
    averageOrder: "Average order value",
    discount: "Discounts",
    refunds: "Refunds",
    units: "units",
    day: "Day",
    week: "Week",
    month: "Month",
    startDate: "Start date",
    endDate: "End date",
    refresh: "Refresh data",
    trendTitle: "Revenue trend",
    trendDescription: "Net sales after refunds are deducted from actual payments",
    chartMode: "Chart view",
    listMode: "List view",
    dailySalesTitle: "Daily sales details",
    salesDate: "Sales date",
    averageOrderValue: "Average order value",
    hourlyTitle: "Trading hours",
    hourlyDescription: "Net sales grouped by order time",
    productTitle: "Actual product sales",
    product: "Product",
    quantity: "Units sold",
    standardSales: "Standard sales",
    productDiscount: "Discounts",
    productRefunds: "Refunds",
    actualNetSales: "Actual net sales",
    standardPrice: "Standard price",
    actualAveragePrice: "Actual average price",
    realisation: "Price realisation",
    loading: "Loading sales data...",
    empty: "No sales data in this date range",
    loadError: "Unable to load sales analysis",
    netSalesLabel: "Net sales",
    periodSummary: "summary",
    channel: "Sales channel",
    allChannels: "All channels",
    channelNames: { DIRECT: "On-site direct", CONSIGNMENT: "Consignment", DELIVERY: "Delivery platform" },
  },
} as const;

export function SalesAnalysisPage() {
  const { locale } = useAppPreferences();
  const text = copy[locale];
  const dateLocale = locale === "en-GB" ? enGB : zhCN;
  const [today] = useState(() => new Date());
  const [trendMode, setTrendMode] = useState<TrendMode>("chart");
  const [periodUnit, setPeriodUnit] = useState<PeriodUnit>("month");
  const [periodCursor, setPeriodCursor] = useState(() => today);
  const [customRange, setCustomRange] = useState(false);
  const [startDate, setStartDate] = useState(() => dateKey(startOfMonth(today)));
  const [endDate, setEndDate] = useState(() => dateKey(today));
  const [channel, setChannel] = useState<SalesChannel | "">("");
  const grain = automaticSalesGrain(periodUnit, customRange, startDate, endDate);
  const [analysis, setAnalysis] = useState<SalesAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const effectiveGrain: SalesAnalysisGrain = trendMode === "list" ? "day" : grain;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAnalysis(await getSalesAnalysis(startDate, endDate, effectiveGrain, channel));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [channel, effectiveGrain, endDate, startDate, text.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const productPagination = useDataPagination(analysis?.products ?? []);
  const trendData = (analysis?.trend ?? []).map((item) => ({
    ...item,
    value: Number(item.net_sales),
    label: formatPeriod(item.period, effectiveGrain, locale, dateLocale),
  }));
  const dailySales = [...(analysis?.trend ?? [])].reverse();
  const dailySalesPagination = useDataPagination(dailySales);
  const kpis = analysis?.kpis;

  function applyPeriod(unit: PeriodUnit, cursor: Date) {
    const [rangeStart, rangeEnd] = periodRange(unit, cursor);
    const visibleEnd = rangeStart <= today && rangeEnd > today ? today : rangeEnd;
    setPeriodUnit(unit);
    setPeriodCursor(cursor);
    setCustomRange(false);
    setStartDate(dateKey(rangeStart));
    setEndDate(dateKey(visibleEnd));
  }

  function shiftPeriod(offset: -1 | 1) {
    applyPeriod(periodUnit, shiftPeriodCursor(periodUnit, periodCursor, offset));
  }
  const metrics = [
    { label: text.netSales, value: money(kpis?.net_sales, locale), icon: PoundSterling, tone: "bg-emerald-50 text-emerald-700" },
    { label: text.salesQuantity, value: `${number(kpis?.sales_quantity ?? 0, locale)} ${text.units}`, icon: ShoppingBag, tone: "bg-blue-50 text-blue-700" },
    { label: text.discount, value: money(kpis?.discount_amount, locale), icon: BadgePercent, tone: "bg-amber-50 text-amber-700" },
    { label: text.refunds, value: money(kpis?.refund_amount, locale), icon: RotateCcw, tone: "bg-rose-50 text-rose-700" },
  ];

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-5">
          <div>
            <PageBreadcrumb fallback={{ zh: text.title, en: text.title }} />
            <p className="mt-1.5 text-sm text-[var(--muted)]">{text.description}</p>
          </div>
        </header>

        <div className="mb-5 flex flex-wrap items-center justify-end gap-2 border-b border-[var(--border)] pb-4">
          <select
            aria-label={text.channel}
            className="h-9 min-w-[160px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
            value={channel}
            onChange={(event) => setChannel(event.target.value as SalesChannel | "")}
          >
            <option value="">{text.allChannels}</option>
            {salesChannels.map((value) => (
              <option key={value} value={value}>{text.channelNames[value]}</option>
            ))}
          </select>
          <PeriodRangeToolbar
            locale={locale}
            unit={periodUnit}
            startDate={startDate}
            endDate={endDate}
            loading={loading}
            onUnitChange={(unit) => applyPeriod(unit, today)}
            onShift={shiftPeriod}
            onStartDateChange={(value) => { setCustomRange(true); setStartDate(value); }}
            onEndDateChange={(value) => { setCustomRange(true); setEndDate(value); }}
            onRefresh={() => void load()}
          />
        </div>

        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={text.title}>
          {metrics.map(({ label, value, icon: Icon, tone }) => (
            <Card key={label} className="min-h-28 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--muted)]">{label}</p>
                  <p className="mt-2 break-words text-xl font-semibold tabular-nums">{loading ? "—" : value}</p>
                </div>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tone)}><Icon className="size-4" /></span>
              </div>
            </Card>
          ))}
        </section>

        {error ? <div className="mb-5 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <section className="mb-5">
          <ChartPanel
            title={trendMode === "list" ? text.dailySalesTitle : text.trendTitle}
            description={text.trendDescription}
            action={(
              <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-0.5">
                <Button
                  type="button"
                  variant={trendMode === "chart" ? "default" : "ghost"}
                  className="h-8 rounded-md px-2.5"
                  aria-pressed={trendMode === "chart"}
                  onClick={() => setTrendMode("chart")}
                >
                  <ChartLine className="size-4" />
                  {text.chartMode}
                </Button>
                <Button
                  type="button"
                  variant={trendMode === "list" ? "default" : "ghost"}
                  className="h-8 rounded-md px-2.5"
                  aria-pressed={trendMode === "list"}
                  onClick={() => setTrendMode("list")}
                >
                  <List className="size-4" />
                  {text.listMode}
                </Button>
              </div>
            )}
            contentClassName={trendMode === "list" ? "p-0" : undefined}
          >
            {trendMode === "list" ? (
              <DailySalesTable
                items={dailySalesPagination.pageItems}
                totalItems={dailySales.length}
                loading={loading}
                locale={locale}
                text={text}
                pagination={dailySalesPagination}
              />
            ) : trendData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tickFormatter={(value) => compactMoney(Number(value), locale)} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={58} />
                  <Tooltip formatter={(value) => [money(String(value ?? 0), locale), text.netSalesLabel]} contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart text={loading ? text.loading : text.empty} />}
          </ChartPanel>
        </section>

        <Card className="overflow-hidden">
          <header className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
            <span className="grid size-9 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]"><ShoppingBag className="size-[18px]" /></span>
            <h2 className="font-semibold">{text.productTitle}</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">{text.product}</th>
                  <th className="px-4 py-3 text-right font-medium">{text.quantity}</th>
                  <th className="px-4 py-3 text-right font-medium">{text.standardSales}</th>
                  <th className="px-4 py-3 text-right font-medium">{text.productDiscount}</th>
                  <th className="px-4 py-3 text-right font-medium">{text.productRefunds}</th>
                  <th className="px-4 py-3 text-right font-medium">{text.actualNetSales}</th>
                  <th className="px-4 py-3 text-right font-medium">{text.standardPrice}</th>
                  <th className="px-4 py-3 text-right font-medium">{text.actualAveragePrice}</th>
                  <th className="px-4 py-3 text-right font-medium">{text.realisation}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? <tr><td colSpan={9} className="px-4 py-12 text-center text-[var(--muted)]">{text.loading}</td></tr> : null}
                {!loading && !productPagination.pageItems.length ? <tr><td colSpan={9} className="px-4 py-12 text-center text-[var(--muted)]">{text.empty}</td></tr> : null}
                {!loading ? productPagination.pageItems.map((product) => (
                  <tr key={product.product_id} className="hover:bg-[var(--surface-muted)]/60">
                    <td className="px-4 py-3">
                      <p className="font-medium">{locale === "zh-CN" ? product.product_name_zh : product.product_name_en}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{locale === "zh-CN" ? product.product_name_en : product.product_name_zh}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{number(product.quantity, locale)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(product.standard_sales, locale)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700">{money(product.discount, locale)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-rose-600">{money(product.refunds, locale)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{money(product.net_sales, locale)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(product.standard_unit_price, locale)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(product.actual_average_price, locale)}</td>
                    <td className="px-4 py-3 text-right"><span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", Number(product.price_realisation_rate) >= 95 ? "bg-emerald-50 text-emerald-700" : Number(product.price_realisation_rate) >= 85 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700")}>{product.price_realisation_rate}%</span></td>
                  </tr>
                )) : null}
              </tbody>
            </table>
          </div>
          <DataPagination locale={locale} page={productPagination.page} pageSize={productPagination.pageSize} pageCount={productPagination.pageCount} totalItems={analysis?.products.length ?? 0} onPageChange={productPagination.setPage} onPageSizeChange={productPagination.setPageSize} />
        </Card>
      </main>
    </DashboardShell>
  );
}

type LocalText = (typeof copy)[keyof typeof copy];

function ChartPanel({ title, description, action, contentClassName, children }: { title: string; description: string; action?: ReactNode; contentClassName?: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
        </div>
        {action}
      </header>
      <div className={cn("h-[320px] p-4", contentClassName)}>{children}</div>
    </Card>
  );
}

function DailySalesTable({ items, totalItems, loading, locale, text, pagination }: {
  items: SalesAnalysis["trend"];
  totalItems: number;
  loading: boolean;
  locale: "zh-CN" | "en-GB";
  text: LocalText;
  pagination: ReturnType<typeof useDataPagination<SalesAnalysis["trend"][number]>>;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-muted)] text-xs text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">{text.salesDate}</th>
              <th className="px-4 py-3 text-right font-medium">{text.standardSales}</th>
              <th className="px-4 py-3 text-right font-medium">{text.productDiscount}</th>
              <th className="px-4 py-3 text-right font-medium">{text.productRefunds}</th>
              <th className="px-4 py-3 text-right font-medium">{text.actualNetSales}</th>
              <th className="px-4 py-3 text-right font-medium">{text.quantity}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-[var(--muted)]">{text.loading}</td></tr> : null}
            {!loading && !items.length ? <tr><td colSpan={6} className="px-4 py-12 text-center text-[var(--muted)]">{text.empty}</td></tr> : null}
            {!loading ? items.map((item) => (
              <tr key={item.period} className="hover:bg-[var(--surface-muted)]/60">
                <td className="whitespace-nowrap px-4 py-3 font-medium">{formatSalesDate(item.period, locale)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(item.standard_sales, locale)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-amber-700">{money(item.discount, locale)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-rose-600">{money(item.refunds, locale)}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{money(item.net_sales, locale)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{number(item.quantity, locale)}</td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
      <DataPagination
        locale={locale}
        page={pagination.page}
        pageSize={pagination.pageSize}
        pageCount={pagination.pageCount}
        totalItems={totalItems}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return <div className="grid h-full place-items-center text-sm text-[var(--muted)]"><CalendarRange className="mb-2 size-7" /><span>{text}</span></div>;
}

function dateKey(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function automaticSalesGrain(
  unit: PeriodUnit,
  customRange: boolean,
  startDate: string,
  endDate: string,
): SalesAnalysisGrain {
  if (!customRange) return unit === "year" ? "month" : "day";
  const days = differenceInCalendarDays(
    new Date(`${endDate}T12:00:00`),
    new Date(`${startDate}T12:00:00`),
  ) + 1;
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
}

function formatSalesDate(value: string, locale: "zh-CN" | "en-GB") {
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", weekday: "short" }).format(new Date(`${value}T12:00:00`));
}

function formatPeriod(period: string, grain: SalesAnalysisGrain, locale: "zh-CN" | "en-GB", dateLocale: typeof enGB) {
  const value = parseISO(period);
  if (grain === "month") return format(value, locale === "zh-CN" ? "yyyy年M月" : "MMM yyyy", { locale: dateLocale });
  if (grain === "week") return format(value, locale === "zh-CN" ? "M月d日" : "d MMM", { locale: dateLocale });
  return format(value, locale === "zh-CN" ? "M/d" : "d MMM", { locale: dateLocale });
}

function money(value: string | undefined, locale: "zh-CN" | "en-GB") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "GBP" }).format(Number(value ?? 0));
}

function compactMoney(value: number, locale: "zh-CN" | "en-GB") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "GBP", notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function number(value: number, locale: "zh-CN" | "en-GB") {
  return new Intl.NumberFormat(locale).format(value);
}

const tooltipStyle = {
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};
