"use client";

import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

import { useDashboardNavigation } from "@/components/dashboard/dashboard-shell";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import type { NavigationTreeItem } from "@/lib/api";

export function PageBreadcrumb({ fallback }: { fallback?: { zh: string; en: string } }) {
  const pathname = usePathname();
  const { locale } = useAppPreferences();
  const { tree } = useDashboardNavigation();
  const labels = findBreadcrumb(tree?.items ?? [], pathname, locale);
  const fallbackLabel = locale === "en-GB" ? fallback?.en : fallback?.zh;
  const resolvedLabels = labels.length ? labels : fallbackLabel ? [fallbackLabel] : [pathname];

  return (
    <h1 className="flex min-w-0 flex-wrap items-center gap-2 text-[28px] font-bold tracking-[-0.035em]">
      {resolvedLabels.map((label, index) => (
        <span key={`${label}-${index}`} className="contents">
          {index > 0 ? <ChevronRight className="size-5 shrink-0 text-[var(--muted)]" aria-hidden="true" /> : null}
          <span className="min-w-0 truncate">{label}</span>
        </span>
      ))}
    </h1>
  );
}

function findBreadcrumb(items: NavigationTreeItem[], pathname: string, locale: "zh-CN" | "en-GB") {
  for (const item of items) {
    if (item.item_type === "PAGE" && item.frontend_path === pathname) return [labelFor(item, locale)];
    const page = item.children.find((child) => child.item_type === "PAGE" && child.frontend_path === pathname);
    if (page) return [labelFor(item, locale), labelFor(page, locale)];
  }
  return [];
}

function labelFor(item: NavigationTreeItem, locale: "zh-CN" | "en-GB") {
  return locale === "en-GB" ? item.label_en : item.label_zh;
}
