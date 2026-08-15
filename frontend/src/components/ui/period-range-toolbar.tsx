"use client";

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PeriodUnit = "day" | "week" | "month" | "year";

type Props = {
  locale: "zh-CN" | "en-GB";
  unit: PeriodUnit;
  startDate: string;
  endDate: string;
  loading?: boolean;
  onUnitChange: (unit: PeriodUnit) => void;
  onShift: (offset: -1 | 1) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onRefresh?: () => void;
};

const labels = {
  "zh-CN": {
    units: { day: "今日", week: "本周", month: "本月", year: "本年" },
    previous: "上一时间段",
    next: "下一时间段",
    start: "开始日期",
    end: "结束日期",
    refresh: "刷新数据",
  },
  "en-GB": {
    units: { day: "Today", week: "This week", month: "This month", year: "This year" },
    previous: "Previous period",
    next: "Next period",
    start: "Start date",
    end: "End date",
    refresh: "Refresh data",
  },
} as const;

export function PeriodRangeToolbar({
  locale,
  unit,
  startDate,
  endDate,
  loading = false,
  onUnitChange,
  onShift,
  onStartDateChange,
  onEndDateChange,
  onRefresh,
}: Props) {
  const text = labels[locale];
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-0.5">
        {(["day", "week", "month", "year"] as PeriodUnit[]).map((value) => (
          <Button
            key={value}
            type="button"
            variant={unit === value ? "default" : "ghost"}
            className="h-8 rounded-md px-3"
            onClick={() => onUnitChange(value)}
          >
            {text.units[value]}
          </Button>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="size-8 rounded-lg" aria-label={text.previous} onClick={() => onShift(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex w-[250px] shrink-0 items-center justify-center sm:w-[278px]">
          {unit === "day" ? (
            <p className="w-full text-center text-sm font-medium tabular-nums">{formatToolbarDate(startDate, locale)}</p>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <input aria-label={text.start} type="date" value={startDate} max={endDate} className="h-8 w-[115px] shrink-0 rounded-md border-0 bg-transparent px-2 text-xs tabular-nums outline-none transition-colors hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)] focus:ring-2 focus:ring-[var(--primary-ring)] sm:w-[128px]" onChange={(event) => onStartDateChange(event.target.value)} />
              <span className="text-xs text-[var(--muted)]">-</span>
              <input aria-label={text.end} type="date" value={endDate} min={startDate} className="h-8 w-[115px] shrink-0 rounded-md border-0 bg-transparent px-2 text-xs tabular-nums outline-none transition-colors hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)] focus:ring-2 focus:ring-[var(--primary-ring)] sm:w-[128px]" onChange={(event) => onEndDateChange(event.target.value)} />
            </div>
          )}
        </div>
        <Button type="button" variant="outline" size="icon" className="size-8 rounded-lg" aria-label={text.next} onClick={() => onShift(1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      {onRefresh ? (
        <Button type="button" variant="outline" disabled={loading} onClick={onRefresh}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          {text.refresh}
        </Button>
      ) : null}
    </div>
  );
}

export function periodRange(unit: PeriodUnit, cursor: Date): [Date, Date] {
  if (unit === "day") return [cursor, cursor];
  if (unit === "week") return [startOfWeek(cursor, { weekStartsOn: 1 }), endOfWeek(cursor, { weekStartsOn: 1 })];
  if (unit === "month") return [startOfMonth(cursor), endOfMonth(cursor)];
  return [startOfYear(cursor), endOfYear(cursor)];
}

export function shiftPeriodCursor(unit: PeriodUnit, cursor: Date, offset: number) {
  if (unit === "day") return addDays(cursor, offset);
  if (unit === "week") return addWeeks(cursor, offset);
  if (unit === "month") return addMonths(cursor, offset);
  return addYears(cursor, offset);
}

function formatToolbarDate(value: string, locale: "zh-CN" | "en-GB") {
  const date = new Date(`${value}T12:00:00`);
  return format(date, locale === "zh-CN" ? "yyyy/MM/dd" : "dd MMM yyyy");
}
