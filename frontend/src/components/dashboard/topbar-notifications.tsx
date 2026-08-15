"use client";

import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  LoaderCircle,
  PackageX,
  RefreshCw,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  BAKEOPS_DATA_CHANGE_EVENT,
  getEventOverview,
  getInventoryOverview,
  type BusinessEvent,
  type InventoryForecastItem,
} from "@/lib/api";

type TopbarNotificationsProps = {
  locale: "zh-CN" | "en-GB";
};

type NotificationData = {
  inventory: InventoryForecastItem[];
  events: BusinessEvent[];
};

const emptyNotifications: NotificationData = { inventory: [], events: [] };

export function TopbarNotifications({ locale }: TopbarNotificationsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notifications, setNotifications] =
    useState<NotificationData>(emptyNotifications);
  const isEnglish = locale === "en-GB";

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const year = new Date().getFullYear();
    const [inventoryResult, eventResult] = await Promise.allSettled([
      getInventoryOverview(),
      getEventOverview(year),
    ]);

    const inventory =
      inventoryResult.status === "fulfilled"
        ? inventoryResult.value.items
            .filter((item) =>
              ["EMERGENCY", "PURCHASE_REQUIRED", "WATCH"].includes(item.status),
            )
            .sort((left, right) => {
              const severity = {
                EMERGENCY: 0,
                PURCHASE_REQUIRED: 1,
                WATCH: 2,
              } as const;
              const statusDifference =
                severity[left.status as keyof typeof severity] -
                severity[right.status as keyof typeof severity];
              if (statusDifference) return statusDifference;
              return (left.shortage_date ?? "9999-12-31").localeCompare(
                right.shortage_date ?? "9999-12-31",
              );
            })
        : [];
    const events =
      eventResult.status === "fulfilled"
        ? eventResult.value.events
            .filter((event) => event.status === "PREPARATION_RISK")
            .sort((left, right) => left.days_until_start - right.days_until_start)
        : [];

    setNotifications({ inventory, events });
    setError(
      inventoryResult.status === "rejected" && eventResult.status === "rejected",
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadNotifications(), 0);
    const interval = window.setInterval(() => void loadNotifications(), 60_000);
    function refresh() {
      void loadNotifications();
    }
    window.addEventListener("focus", refresh);
    window.addEventListener(BAKEOPS_DATA_CHANGE_EVENT, refresh);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(BAKEOPS_DATA_CHANGE_EVENT, refresh);
    };
  }, [loadNotifications, pathname]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const count = notifications.inventory.length + notifications.events.length;
  const label = isEnglish
    ? count
      ? `Notifications, ${count} alerts`
      : "Notifications"
    : count
      ? `通知，${count}项提醒`
      : "通知";
  const hasNotifications = count > 0;
  const formattedInventory = useMemo(
    () =>
      notifications.inventory.map((item) => ({
        ...item,
        detail:
          item.status === "EMERGENCY"
            ? isEnglish
              ? "Emergency purchase required"
              : "存在无法及时补货风险"
            : item.status === "PURCHASE_REQUIRED"
              ? isEnglish
                ? "Purchase is now required"
                : "已经到达建议采购时间"
              : isEnglish
                ? "Approaching the recommended purchase date"
                : "接近建议采购时间",
      })),
    [isEnglish, notifications.inventory],
  );

  function navigate(path: string) {
    router.push(path);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          void loadNotifications();
        }}
      >
        <span className="relative">
          <Bell className="size-[18px]" />
          {hasNotifications ? (
            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-rose-500 ring-2 ring-[var(--topbar)]" />
          ) : null}
        </span>
      </Button>

      {open ? (
        <div
          role="menu"
          className="fixed top-16 right-3 left-3 z-50 max-h-[min(72vh,34rem)] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-2xl sm:absolute sm:top-11 sm:right-0 sm:left-auto sm:w-[380px]"
        >
          <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold">
                {isEnglish ? "Notifications" : "通知"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {isEnglish ? `${count} active alerts` : `${count}项待处理提醒`}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={loading}
              aria-label={isEnglish ? "Refresh notifications" : "刷新通知"}
              onClick={() => void loadNotifications()}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </header>

          {loading && !hasNotifications ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[var(--muted)]">
              <LoaderCircle className="size-4 animate-spin" />
              {isEnglish ? "Checking alerts..." : "正在检查提醒..."}
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 px-4 py-8 text-sm text-[var(--muted)]">
              <AlertTriangle className="size-5 text-amber-600" />
              {isEnglish ? "Unable to load alerts" : "提醒数据暂时无法读取"}
            </div>
          ) : !hasNotifications ? (
            <div className="px-4 py-10 text-center">
              <CheckCircle2 className="mx-auto size-7 text-emerald-600" />
              <p className="mt-3 text-sm font-medium">
                {isEnglish ? "No alerts" : "暂无提醒事项"}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {isEnglish
                  ? "Inventory and event preparation are on track."
                  : "库存与活动准备情况正常。"}
              </p>
            </div>
          ) : (
            <div className="p-2">
              <NotificationGroup
                title={isEnglish ? "Event preparation risks" : "活动准备风险"}
                emptyText={isEnglish ? "No event preparation risks" : "暂无活动准备风险"}
              >
                {notifications.events.length
                  ? notifications.events.map((event) => (
                      <NotificationItem
                        key={event.id}
                        icon={<CalendarClock className="size-4" />}
                        tone="danger"
                        title={event.name}
                        detail={
                          isEnglish
                            ? `${event.days_until_start} days until start · ${event.checklist_completed}/${event.checklist_total} complete`
                            : `距开始${event.days_until_start}天 · 已完成${event.checklist_completed}/${event.checklist_total}`
                        }
                        onClick={() =>
                          navigate(
                            `/planning/calendar-events?year=${event.start_date.slice(0, 4)}&event=${encodeURIComponent(event.id)}`,
                          )
                        }
                      />
                    ))
                  : null}
              </NotificationGroup>

              <NotificationGroup
                title={isEnglish ? "Inventory risks" : "库存风险"}
                emptyText={isEnglish ? "No inventory risks" : "暂无库存风险"}
              >
                {formattedInventory.length
                  ? formattedInventory.map((item) => (
                      <NotificationItem
                        key={item.ingredient_id}
                        icon={<PackageX className="size-4" />}
                        tone={item.status === "EMERGENCY" ? "danger" : "warning"}
                        title={item.ingredient_name}
                        detail={item.detail}
                        onClick={() =>
                          navigate(
                            `/operations/inventory?ingredient=${encodeURIComponent(item.ingredient_id)}`,
                          )
                        }
                      />
                    ))
                  : null}
              </NotificationGroup>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function NotificationGroup({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-1">
      <p className="px-2 py-1.5 text-[11px] font-semibold text-[var(--muted)]">
        {title}
      </p>
      <div className="space-y-1">
        {children ?? (
          <p className="px-2 py-2 text-xs text-[var(--muted)]">{emptyText}</p>
        )}
      </div>
    </section>
  );
}

function NotificationItem({
  icon,
  tone,
  title,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  tone: "warning" | "danger";
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-[var(--surface-muted)]"
      onClick={onClick}
    >
      <span
        className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${
          tone === "danger"
            ? "bg-rose-50 text-rose-600"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">
          {detail}
        </span>
      </span>
    </button>
  );
}
