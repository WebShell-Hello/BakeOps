"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type FocusEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 1000;

export function useDataPagination<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeValue] = useState(10);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);

  useEffect(() => {
    if (page <= pageCount) return;
    const timer = window.setTimeout(() => setPage(pageCount), 0);
    return () => window.clearTimeout(timer);
  }, [page, pageCount]);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [currentPage, items, pageSize]);

  const setPageSize = useCallback((value: number) => {
    setPageSizeValue(Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.floor(value))));
    setPage(1);
  }, []);

  const resetPage = useCallback(() => setPage(1), []);

  return {
    page: currentPage,
    pageSize,
    pageCount,
    pageItems,
    setPage,
    setPageSize,
    resetPage,
  };
}

export function DataPagination({
  locale,
  page,
  pageSize,
  pageCount,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  locale: "zh-CN" | "en-GB";
  page: number;
  pageSize: number;
  pageCount: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const isEnglish = locale === "en-GB";
  const displayedItems = totalItems === 0
    ? 0
    : Math.min(pageSize, Math.max(0, totalItems - (page - 1) * pageSize));

  function commitPageSize(event: FocusEvent<HTMLInputElement>) {
    const nextPageSize = Number(event.currentTarget.value);
    if (!Number.isFinite(nextPageSize) || nextPageSize < MIN_PAGE_SIZE) {
      event.currentTarget.value = String(pageSize);
      return;
    }
    onPageSizeChange(nextPageSize);
  }

  function commitPageSizeOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-[var(--muted)]">
        {isEnglish
          ? `Viewing ${displayedItems} out of ${totalItems}`
          : `当前显示 ${displayedItems} 条，共 ${totalItems} 条`}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <span className="text-sm text-[var(--muted)]">{isEnglish ? "Rows per page" : "每页条数"}</span>
        <input
          key={pageSize}
          type="number"
          inputMode="numeric"
          min={MIN_PAGE_SIZE}
          max={MAX_PAGE_SIZE}
          step={1}
          list="page-size-options"
          defaultValue={pageSize}
          aria-label={isEnglish ? "Rows per page" : "每页显示数量"}
          className="h-9 w-16 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-center text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]"
          onBlur={commitPageSize}
          onKeyDown={commitPageSizeOnEnter}
        />
        <datalist id="page-size-options">
          {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option} />)}
        </datalist>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-lg px-3"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
          {isEnglish ? "Previous" : "上一页"}
        </Button>
        <span className="min-w-12 text-center text-sm font-medium" aria-label={isEnglish ? `Page ${page} of ${pageCount}` : `第 ${page} 页，共 ${pageCount} 页`}>
          {page}/{pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-lg px-3"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          {isEnglish ? "Next" : "下一页"}
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
