"use client";

import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfMonth,
  subDays,
} from "date-fns";
import { enGB, zhCN } from "date-fns/locale";
import {
  BarChart3,
  ChartLine,
  CircleDollarSign,
  Factory,
  Lightbulb,
  Minus,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { Card } from "@/components/ui/card";
import {
  PeriodRangeToolbar,
  periodRange,
  shiftPeriodCursor,
  type PeriodUnit,
} from "@/components/ui/period-range-toolbar";
import {
  getProfitabilityAnalysis,
  type ProfitabilityAnalysis,
  type ProfitabilityAnalysisGrain,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const copy = {
  "zh-CN": {
    title: "盈利分析",
    description: "把实际销售、材料耗用和经营成本合并，查看门店赚了多少以及哪些产品贡献最多。",
    dayUnit: "今日",
    weekUnit: "本周",
    monthUnit: "本月",
    yearUnit: "本年",
    previousDay: "上一日",
    nextDay: "下一日",
    previousWeek: "上周",
    nextWeek: "下周",
    previousMonth: "上月",
    nextMonth: "下月",
    previousYear: "上一年",
    nextYear: "下一年",
    start: "开始日期",
    end: "结束日期",
    refresh: "刷新数据",
    netSales: "净销售收入",
    materialCost: "物料耗用成本",
    grossProfit: "毛利润",
    grossMargin: "毛利率",
    wages: "人工成本",
    otherCosts: "其他经营成本",
    operatingProfit: "经营利润",
    operatingMargin: "经营利润率",
    trend: "利润趋势",
    trendDescription: "按时间粒度比较收入、毛利润和经营利润",
    netSalesFormula: "实际支付金额 - 退款",
    grossProfitFormula: "净销售收入 - 物料耗用成本",
    operatingProfitFormula: "毛利润 - 人工成本 - 其他经营成本",
    formulaTitle: "指标公式",
    previousDayValue: "上日",
    previousWeekValue: "上周",
    previousMonthValue: "上月",
    previousYearValue: "上年",
    previousRangeValue: "上期",
    costStructure: "成本结构",
    materials: "食材物料",
    other: "其他成本",
    productContribution: "产品利润贡献",
    contributionNote: "产品层只计算实际净销售收入减对应材料成本，不分摊房租和人工。",
    product: "产品",
    quantity: "销量",
    revenue: "净销售收入",
    contributionCost: "预估材料成本",
    contributionProfit: "贡献毛利",
    contributionMargin: "贡献毛利率",
    contributionShare: "利润贡献占比",
    quadrant: "产品表现四象限",
    quadrantNote: "横轴为净销售收入，纵轴为贡献毛利率。",
    star: "明星产品",
    potential: "潜力产品",
    traffic: "引流产品",
    review: "淘汰候选",
    empty: "当前范围没有可用数据",
    loading: "正在读取盈利数据...",
    error: "盈利分析加载失败",
  },
  "en-GB": {
    title: "Profitability Analysis",
    description: "Combine actual sales, material usage and operating costs to show what the shop earns and which products contribute most.",
    dayUnit: "Today",
    weekUnit: "This week",
    monthUnit: "This month",
    yearUnit: "This year",
    previousDay: "Previous day",
    nextDay: "Next day",
    previousWeek: "Previous week",
    nextWeek: "Next week",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    previousYear: "Previous year",
    nextYear: "Next year",
    start: "Start date",
    end: "End date",
    refresh: "Refresh data",
    netSales: "Net sales revenue",
    materialCost: "Material usage cost",
    grossProfit: "Gross profit",
    grossMargin: "Gross margin",
    wages: "Labour cost",
    otherCosts: "Other operating costs",
    operatingProfit: "Operating profit",
    operatingMargin: "Operating margin",
    trend: "Profit trend",
    trendDescription: "Compare revenue, gross profit and operating profit by time grain",
    netSalesFormula: "Actual payments - refunds",
    grossProfitFormula: "Net sales revenue - material usage cost",
    operatingProfitFormula: "Gross profit - labour cost - other operating costs",
    formulaTitle: "Metric formulas",
    previousDayValue: "Previous day",
    previousWeekValue: "Previous week",
    previousMonthValue: "Previous month",
    previousYearValue: "Previous year",
    previousRangeValue: "Previous period",
    costStructure: "Cost structure",
    materials: "Ingredients & materials",
    other: "Other costs",
    productContribution: "Product profit contribution",
    contributionNote: "Product contribution is net sales minus material cost. Rent and labour are kept at store level.",
    product: "Product",
    quantity: "Units sold",
    revenue: "Net sales",
    contributionCost: "Estimated material cost",
    contributionProfit: "Contribution profit",
    contributionMargin: "Contribution margin",
    contributionShare: "Profit contribution",
    quadrant: "Product performance quadrant",
    quadrantNote: "Horizontal axis is net sales; vertical axis is contribution margin.",
    star: "Star products",
    potential: "Potential products",
    traffic: "Traffic drivers",
    review: "Review candidates",
    empty: "No data is available for this range",
    loading: "Loading profitability data...",
    error: "Unable to load profitability analysis",
  },
} as const;

const quadrantStyles = {
  STAR: "border-emerald-200 bg-emerald-50/70",
  POTENTIAL: "border-sky-200 bg-sky-50/70",
  TRAFFIC: "border-amber-200 bg-amber-50/70",
  REVIEW: "border-rose-200 bg-rose-50/70",
} as const;

export function ProfitabilityAnalysisPage() {
  const { locale } = useAppPreferences();
  const text = copy[locale];
  const dateLocale = locale === "en-GB" ? enGB : zhCN;
  const [today] = useState(() => new Date());
  const [periodUnit, setPeriodUnit] = useState<PeriodUnit>("month");
  const [periodCursor, setPeriodCursor] = useState(() => today);
  const [customRange, setCustomRange] = useState(false);
  const [startDate, setStartDate] = useState(() => dateKey(startOfMonth(today)));
  const [endDate, setEndDate] = useState(() => dateKey(today));
  const grain = automaticTrendGrain(periodUnit, customRange, startDate, endDate);
  const [analysis, setAnalysis] = useState<ProfitabilityAnalysis | null>(null);
  const [previousAnalysis, setPreviousAnalysis] = useState<ProfitabilityAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const previous = previousComparisonRange(
        parseDate(startDate),
        parseDate(endDate),
        periodUnit,
        periodCursor,
        customRange,
      );
      const [currentResult, previousResult] = await Promise.all([
        getProfitabilityAnalysis(startDate, endDate, grain),
        getProfitabilityAnalysis(dateKey(previous[0]), dateKey(previous[1]), grain),
      ]);
      setAnalysis(currentResult);
      setPreviousAnalysis(previousResult);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.error);
    } finally {
      setLoading(false);
    }
  }, [customRange, endDate, grain, periodCursor, periodUnit, startDate, text.error]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function applyPeriod(unit: PeriodUnit, cursor: Date) {
    const [rangeStart, rangeEnd] = periodRange(unit, cursor);
    const visibleEnd = rangeStart <= today && rangeEnd > today ? today : rangeEnd;
    setPeriodUnit(unit);
    setPeriodCursor(cursor);
    setCustomRange(false);
    setStartDate(dateKey(rangeStart));
    setEndDate(dateKey(visibleEnd));
  }

  function shiftPeriod(offset: number) {
    applyPeriod(periodUnit, shiftPeriodCursor(periodUnit, periodCursor, offset));
  }

  const comparisonLabel = customRange
    ? text.previousRangeValue
    : periodUnit === "day"
      ? text.previousDayValue
      : periodUnit === "week"
        ? text.previousWeekValue
        : periodUnit === "month"
          ? text.previousMonthValue
          : text.previousYearValue;

  const kpis = analysis?.kpis;
  const previousKpis = previousAnalysis?.kpis;
  const trend = (analysis?.trend ?? []).map((item) => ({
    ...item,
    label: formatPeriod(item.period, grain, dateLocale),
    net: Number(item.net_sales),
    gross: Number(item.gross_profit),
    operating: Number(item.operating_profit),
  }));
  const costData = (analysis?.cost_structure ?? []).filter((item) => Number(item.amount) > 0).map((item) => ({
    name: item.key === "MATERIALS" ? text.materials : item.key === "WAGES" ? text.wages : text.other,
    value: Number(item.amount),
  }));
  const metrics = [
    { label: text.netSales, current: Number(kpis?.net_sales ?? 0), previous: Number(previousKpis?.net_sales ?? 0), format: money, icon: CircleDollarSign, tone: "bg-emerald-50 text-emerald-700" },
    { label: text.materialCost, current: Number(kpis?.material_cost ?? 0), previous: Number(previousKpis?.material_cost ?? 0), format: money, icon: Factory, tone: "bg-orange-50 text-orange-700" },
    { label: text.grossProfit, current: Number(kpis?.gross_profit ?? 0), previous: Number(previousKpis?.gross_profit ?? 0), format: money, icon: ChartLine, tone: "bg-sky-50 text-sky-700" },
    { label: text.grossMargin, current: Number(kpis?.gross_margin ?? 0), previous: Number(previousKpis?.gross_margin ?? 0), format: percentageValue, icon: Target, tone: "bg-cyan-50 text-cyan-700" },
    { label: text.wages, current: Number(kpis?.wages ?? 0), previous: Number(previousKpis?.wages ?? 0), format: money, icon: WalletCards, tone: "bg-violet-50 text-violet-700" },
    { label: text.otherCosts, current: Number(kpis?.other_costs ?? 0), previous: Number(previousKpis?.other_costs ?? 0), format: money, icon: BarChart3, tone: "bg-amber-50 text-amber-700" },
    { label: text.operatingProfit, current: Number(kpis?.operating_profit ?? 0), previous: Number(previousKpis?.operating_profit ?? 0), format: money, icon: Star, tone: "bg-indigo-50 text-indigo-700" },
    { label: text.operatingMargin, current: Number(kpis?.operating_margin ?? 0), previous: Number(previousKpis?.operating_margin ?? 0), format: percentageValue, icon: Lightbulb, tone: "bg-rose-50 text-rose-700" },
  ];

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-5">
          <div>
            <PageBreadcrumb fallback={{ zh: text.title, en: text.title }} />
            <p className="mt-1.5 max-w-3xl text-sm text-[var(--muted)]">{text.description}</p>
          </div>
        </header>

        <div className="mb-5 flex flex-wrap items-center justify-end gap-2 border-b border-[var(--border)] pb-4">
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
          {metrics.map(({ label, current, previous, format: formatValue, icon: Icon, tone }) => (
            <Card key={label} className="min-h-28 p-4">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="text-xs text-[var(--muted)]">{label}</p><div className="mt-2 flex items-center gap-1.5"><p className="min-w-0 break-words text-xl font-semibold tabular-nums">{loading ? "—" : formatValue(current)}</p>{!loading ? <TrendDirection current={current} previous={previous} /> : null}</div><p className="mt-1 text-xs text-[var(--muted)]">{comparisonLabel} <span className="tabular-nums">{loading ? "—" : formatValue(previous)}</span></p></div><span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tone)}><Icon className="size-4" /></span></div>
            </Card>
          ))}
        </section>

        {error ? <div className="mb-5 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <section className="mb-5">
          <Card className="p-4">
            <div className="mb-4"><h2 className="font-semibold">{text.trend}</h2><p className="mt-1 text-sm text-[var(--muted)]">{text.trendDescription}</p></div>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="h-[320px]">{trend.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} minTickGap={26} /><YAxis tickFormatter={(value) => compactMoney(Number(value))} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={58} /><Tooltip formatter={(value, name) => [money(String(value ?? 0)), String(name)]} /><Line type="monotone" dataKey="net" name={text.netSales} stroke="#277da1" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="gross" name={text.grossProfit} stroke="#43aa8b" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="operating" name={text.operatingProfit} stroke="#f28f3b" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer> : <EmptyState text={loading ? text.loading : text.empty} />}</div>
              <ProfitFormulaPanel text={text} />
            </div>
          </Card>
        </section>

        <div className="mb-5"><CostStructure data={costData} text={text} /></div>

        <Card className="mb-5 overflow-hidden">
          <header className="border-b border-[var(--border)] px-5 py-4"><h2 className="font-semibold">{text.productContribution}</h2><p className="mt-1 text-sm text-[var(--muted)]">{text.contributionNote}</p></header>
          <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-sm"><thead className="bg-[var(--surface-muted)] text-xs text-[var(--muted)]"><tr><th className="px-4 py-3">{text.product}</th><th className="px-4 py-3 text-right">{text.quantity}</th><th className="px-4 py-3 text-right">{text.revenue}</th><th className="px-4 py-3 text-right">{text.contributionCost}</th><th className="px-4 py-3 text-right">{text.contributionProfit}</th><th className="px-4 py-3 text-right">{text.contributionMargin}</th><th className="px-4 py-3 text-right">{text.contributionShare}</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{analysis?.products.map((item) => <tr key={item.product_id} className="hover:bg-[var(--surface-muted)]/60"><td className="px-4 py-3"><p className="font-medium">{locale === "zh-CN" ? item.product_name_zh : item.product_name_en}</p><p className="text-xs text-[var(--muted)]">{locale === "zh-CN" ? item.product_name_en : item.product_name_zh}</p></td><td className="px-4 py-3 text-right tabular-nums">{item.quantity.toLocaleString(locale)}</td><td className="px-4 py-3 text-right tabular-nums">{money(item.net_sales)}</td><td className="px-4 py-3 text-right tabular-nums">{money(item.material_cost)}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{money(item.contribution_profit)}</td><td className="px-4 py-3 text-right tabular-nums">{item.contribution_margin}%</td><td className="px-4 py-3 text-right tabular-nums">{item.contribution_share}%</td></tr>)}{!loading && !analysis?.products.length ? <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--muted)]">{text.empty}</td></tr> : null}{loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--muted)]">{text.loading}</td></tr> : null}</tbody></table></div>
        </Card>

        <Card className="p-4"><div className="mb-4"><h2 className="font-semibold">{text.quadrant}</h2><p className="mt-1 text-sm text-[var(--muted)]">{text.quadrantNote}</p></div><div className="grid gap-3 md:grid-cols-2">{(["STAR", "POTENTIAL", "TRAFFIC", "REVIEW"] as const).map((key) => { const items = (analysis?.products ?? []).filter((item) => item.quadrant === key); const label = key === "STAR" ? text.star : key === "POTENTIAL" ? text.potential : key === "TRAFFIC" ? text.traffic : text.review; return <div key={key} className={cn("min-h-32 rounded-lg border p-4", quadrantStyles[key])}><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">{label}</h3><span className="text-xs tabular-nums text-[var(--muted)]">{items.length}</span></div><div className="flex flex-wrap gap-2">{items.slice(0, 8).map((item) => <span key={item.product_id} className="rounded-md bg-white/75 px-2 py-1 text-xs">{locale === "zh-CN" ? item.product_name_zh : item.product_name_en}</span>)}</div></div>; })}</div></Card>
      </main>
    </DashboardShell>
  );
}

function CostStructure({ data, text }: { data: Array<{ name: string; value: number }>; text: typeof copy["zh-CN"] | typeof copy["en-GB"] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return <Card className="p-4"><h2 className="font-semibold">{text.costStructure}</h2><div className="mt-5 space-y-4">{data.length ? data.map((item, index) => { const share = total ? item.value / total * 100 : 0; return <div key={item.name}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{item.name}</span><span className="font-medium tabular-nums">{money(item.value)} · {share.toFixed(1)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className={cn("h-full rounded-full", index === 0 ? "bg-orange-400" : index === 1 ? "bg-violet-500" : "bg-sky-500")} style={{ width: `${share}%` }} /></div></div>; }) : <EmptyState text="—" />}</div></Card>;
}

function ProfitFormulaPanel({ text }: { text: typeof copy["zh-CN"] | typeof copy["en-GB"] }) {
  const formulas = [
    { label: text.netSales, formula: text.netSalesFormula, colour: "bg-[#277da1]" },
    { label: text.grossProfit, formula: text.grossProfitFormula, colour: "bg-[#43aa8b]" },
    { label: text.operatingProfit, formula: text.operatingProfitFormula, colour: "bg-[#f28f3b]" },
  ];
  return (
    <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/45 p-4">
      <h3 className="text-sm font-semibold">{text.formulaTitle}</h3>
      <div className="mt-4 space-y-4">
        {formulas.map((item) => (
          <div key={item.label}>
            <div className="flex items-center gap-2 text-sm font-medium"><span className={cn("size-2.5 rounded-full", item.colour)} />{item.label}</div>
            <p className="mt-1 pl-[18px] text-xs leading-5 text-[var(--muted)]">{item.formula}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

function TrendDirection({ current, previous }: { current: number; previous: number }) {
  if (current > previous) return <TrendingUp className="size-4 shrink-0 text-emerald-600" aria-label="up" />;
  if (current < previous) return <TrendingDown className="size-4 shrink-0 text-rose-600" aria-label="down" />;
  return <Minus className="size-4 shrink-0 text-[var(--muted)]" aria-label="unchanged" />;
}

function EmptyState({ text }: { text: string }) { return <div className="grid h-full min-h-40 place-items-center text-sm text-[var(--muted)]">{text}</div>; }
function dateKey(value: Date) { return format(value, "yyyy-MM-dd"); }
function parseDate(value: string) { return new Date(`${value}T12:00:00`); }
function money(value?: string | number) { return `£${Number(value ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function percentageValue(value?: string | number) { return `${Number(value ?? 0).toFixed(1)}%`; }
function compactMoney(value: number) { return `£${Math.round(value).toLocaleString("en-GB")}`; }
function formatPeriod(value: string, grain: ProfitabilityAnalysisGrain, locale: Locale) { const date = parseDate(value); return grain === "month" ? format(date, "MMM yy", { locale }) : grain === "week" ? format(date, "dd MMM", { locale }) : format(date, "dd MMM", { locale }); }
type Locale = typeof enGB;

function previousComparisonRange(
  currentStart: Date,
  currentEnd: Date,
  unit: PeriodUnit,
  cursor: Date,
  customRange: boolean,
): [Date, Date] {
  const elapsedDays = differenceInCalendarDays(currentEnd, currentStart);
  if (customRange) {
    const previousEnd = subDays(currentStart, 1);
    return [subDays(previousEnd, elapsedDays), previousEnd];
  }
  const previousCursor = shiftPeriodCursor(unit, cursor, -1);
  const [previousStart, previousFullEnd] = periodRange(unit, previousCursor);
  const matchingEnd = addDays(previousStart, elapsedDays);
  return [previousStart, matchingEnd < previousFullEnd ? matchingEnd : previousFullEnd];
}

function automaticTrendGrain(
  unit: PeriodUnit,
  customRange: boolean,
  startDate: string,
  endDate: string,
): ProfitabilityAnalysisGrain {
  if (!customRange) return unit === "year" ? "month" : "day";
  const days = differenceInCalendarDays(parseDate(endDate), parseDate(startDate)) + 1;
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
}
