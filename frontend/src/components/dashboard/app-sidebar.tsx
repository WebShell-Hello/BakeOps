"use client";

import { ChefHat, ChevronRight, Pin } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type FocusEventHandler,
  type MouseEventHandler,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import { UserMenu } from "@/components/auth/user-menu";
import { NavigationIcon } from "@/components/navigation/navigation-icon";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { cn } from "@/lib/utils";
import { type NavigationTreeItem } from "@/lib/api";

export type SidebarMode = "pinned" | "auto";

const sidebarModeSequence: Record<SidebarMode, SidebarMode> = {
  pinned: "auto",
  auto: "pinned",
};

const OPEN_SECTIONS_STORAGE_KEY = "bakeops-sidebar-open-sections";
const OPEN_SECTIONS_CHANGE_EVENT = "bakeops-sidebar-open-sections-change";

function getOpenSectionsSnapshot() {
  return window.localStorage.getItem(OPEN_SECTIONS_STORAGE_KEY) ?? "analytics";
}

function subscribeToOpenSections(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(OPEN_SECTIONS_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(OPEN_SECTIONS_CHANGE_EVENT, callback);
  };
}

function saveOpenSections(sections: Set<string>) {
  window.localStorage.setItem(OPEN_SECTIONS_STORAGE_KEY, [...sections].join(","));
  window.dispatchEvent(new Event(OPEN_SECTIONS_CHANGE_EVENT));
}

type AppSidebarProps = {
  className?: string;
  expanded: boolean;
  mobile?: boolean;
  mode?: SidebarMode;
  items: NavigationTreeItem[];
  loading?: boolean;
  error?: string | null;
  onModeChange?: (mode: SidebarMode) => void;
  onNavigate?: () => void;
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  onFocusCapture?: FocusEventHandler<HTMLElement>;
  onBlurCapture?: FocusEventHandler<HTMLElement>;
};

export function AppSidebar({
  className,
  expanded,
  mobile = false,
  mode = "pinned",
  items,
  loading = false,
  error,
  onModeChange,
  onNavigate,
  onMouseEnter,
  onMouseLeave,
  onFocusCapture,
  onBlurCapture,
}: AppSidebarProps) {
  const { locale } = useAppPreferences();
  const pathname = usePathname();
  const isEnglish = locale === "en-GB";
  const activeParent = items.find((item) => item.children.some((child) => child.frontend_path === pathname));
  const openSectionsSnapshot = useSyncExternalStore(
    subscribeToOpenSections,
    getOpenSectionsSnapshot,
    () => "analytics",
  );
  const openSections = useMemo(
    () => new Set(openSectionsSnapshot.split(",").filter(Boolean)),
    [openSectionsSnapshot],
  );
  const lastProcessedRouteRef = useRef<{ pathname: string; parentKey: string | null } | null>(null);
  const sidebarModeLabels: Record<SidebarMode, string> = isEnglish
    ? { pinned: "Pinned", auto: "Auto collapse" }
    : { pinned: "固定", auto: "自动折叠" };
  const nextMode = sidebarModeSequence[mode];

  useEffect(() => {
    const parentKey = activeParent?.key ?? null;
    const lastProcessedRoute = lastProcessedRouteRef.current;
    if (lastProcessedRoute?.pathname === pathname && lastProcessedRoute.parentKey === parentKey) return;

    lastProcessedRouteRef.current = { pathname, parentKey };
    if (!activeParent || openSections.has(activeParent.key)) return;
    saveOpenSections(new Set([...openSections, activeParent.key]));
  }, [activeParent, openSections, pathname]);

  function labelFor(item: NavigationTreeItem) {
    return isEnglish ? item.label_en : item.label_zh;
  }

  function toggleSection(item: NavigationTreeItem) {
    const nextOpenSections = new Set(openSections);
    if (nextOpenSections.has(item.key)) nextOpenSections.delete(item.key);
    else nextOpenSections.add(item.key);
    saveOpenSections(nextOpenSections);
  }

  function renderPage(item: NavigationTreeItem, child = false) {
    const label = labelFor(item);
    const path = item.frontend_path;
    const active = path === pathname;
    const className = child
      ? cn(
          "flex min-h-9 w-full items-center rounded-lg px-3 py-2 text-left text-[13px] leading-4 transition-colors",
          active
            ? "bg-[var(--primary-soft)] font-medium text-[var(--primary)]"
            : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
        )
      : cn(
          "flex h-12 w-full items-center rounded-xl text-[15px] font-medium transition-colors",
          expanded ? "gap-4 px-4" : "justify-center px-0",
          active
            ? "bg-[var(--primary-soft)] text-[var(--primary)]"
            : "text-[var(--nav-foreground)] hover:bg-[var(--surface-muted)]",
        );

    if (!path) {
      return (
        <button key={item.id} type="button" aria-disabled="true" title={!expanded ? label : undefined} className={className}>
          {!child ? <NavigationIcon iconKey={item.icon_key} className="size-[19px]" /> : null}
          <span className={child ? undefined : cn("overflow-hidden text-left whitespace-nowrap", expanded ? "w-[120px]" : "w-0")}>
            {label}
          </span>
        </button>
      );
    }

    return (
      <Link
        key={item.id}
        href={path}
        title={!expanded ? label : undefined}
        aria-current={active ? "page" : undefined}
        className={className}
        onClick={onNavigate}
      >
        {!child ? <NavigationIcon iconKey={item.icon_key} className="size-[19px]" /> : null}
        <span className={child ? undefined : cn("overflow-hidden text-left whitespace-nowrap", expanded ? "w-[120px]" : "w-0")}>
          {label}
        </span>
      </Link>
    );
  }

  return (
    <aside
      data-sidebar-mode={mode}
      data-sidebar-expanded={expanded}
      className={cn(
        "app-sidebar flex shrink-0 flex-col overflow-hidden border-r border-[var(--border)] transition-[width] duration-200 ease-out",
        expanded ? "w-[236px]" : "w-[76px]",
        className,
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <div className={cn("relative flex h-[94px] shrink-0 items-center", expanded ? "gap-3 px-7" : "justify-center px-2")}>
        {!expanded && !mobile ? (
          <button
            type="button"
            aria-label={isEnglish ? "Pin sidebar open" : "固定展开侧边栏"}
            title={isEnglish ? "Pin sidebar open" : "固定展开侧边栏"}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm shadow-[var(--primary-shadow)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ring)]"
            onClick={() => onModeChange?.("pinned")}
          >
            <ChefHat className="size-5" strokeWidth={2.2} />
          </button>
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm shadow-[var(--primary-shadow)]">
            <ChefHat className="size-5" strokeWidth={2.2} />
          </span>
        )}
        <span
          aria-hidden={!expanded}
          className={cn(
            "overflow-hidden text-[25px] font-bold tracking-[-0.04em] whitespace-nowrap transition-[width,opacity] duration-150",
            expanded ? "w-[112px] opacity-100" : "w-0 opacity-0",
          )}
        >
          BakeOps
        </span>

        {!mobile && expanded ? (
          <button
            type="button"
            aria-label={
              isEnglish
                ? `Sidebar: ${sidebarModeLabels[mode]}. Switch to: ${sidebarModeLabels[nextMode]}`
                : `侧边栏当前：${sidebarModeLabels[mode]}。切换为：${sidebarModeLabels[nextMode]}`
            }
            title={
              isEnglish
                ? `Current: ${sidebarModeLabels[mode]} · Switch to ${sidebarModeLabels[nextMode]}`
                : `当前：${sidebarModeLabels[mode]} · 点击切换为${sidebarModeLabels[nextMode]}`
            }
            className="absolute top-[35px] right-3 grid size-6 place-items-center rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] shadow-sm transition-all hover:border-[var(--primary-border)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ring)]"
            onClick={() => onModeChange?.(nextMode)}
          >
            <Pin
              className={cn(
                "size-3.5 transition-transform duration-200",
                mode === "pinned" && "fill-current",
                mode === "auto" && "rotate-45",
              )}
            />
          </button>
        ) : null}
      </div>

      <nav aria-label={isEnglish ? "Main navigation" : "主导航"} className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-1">
          {loading && expanded ? <p className="px-4 py-3 text-xs text-[var(--muted)]">{isEnglish ? "Loading navigation..." : "正在加载导航..."}</p> : null}
          {error && expanded ? <p className="px-4 py-3 text-xs text-rose-500">{isEnglish ? "Navigation unavailable" : "导航暂时不可用"}</p> : null}

          {items.map((item) => {
            if (item.item_type === "PAGE") {
              return renderPage(item);
            }

            const isOpen = openSections.has(item.key);
            const label = labelFor(item);
            return (
              <div key={item.id}>
                <button
                  type="button"
                  title={!expanded ? label : undefined}
                  aria-label={!expanded ? label : undefined}
                  aria-expanded={expanded ? isOpen : undefined}
                  className={cn(
                    "flex h-11 w-full items-center rounded-xl text-[14px] font-medium text-[var(--nav-foreground)] transition-colors hover:bg-[var(--surface-muted)]",
                    expanded ? "gap-3 px-4" : "justify-center px-0",
                  )}
                  onClick={() => toggleSection(item)}
                >
                  <NavigationIcon iconKey={item.icon_key} className="size-[18px]" />
                  <span className={cn("min-w-0 overflow-hidden text-left whitespace-nowrap", expanded ? "w-[126px] flex-1" : "w-0")}>
                    {label}
                  </span>
                  <ChevronRight
                    className={cn(
                      "size-4 shrink-0 text-[var(--muted)] transition-transform duration-200",
                      isOpen && "rotate-90",
                      !expanded && "hidden",
                    )}
                  />
                </button>

                {expanded && isOpen ? (
                  <div className="relative ml-[25px] border-l border-[var(--border)] py-1 pl-3">
                    {item.children.map((child) => renderPage(child, true))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </nav>

      <div className={cn("shrink-0 border-t border-[var(--border)]", expanded ? "p-4" : "px-3 py-4")}>
        <UserMenu placement="sidebar" expanded={expanded} onNavigate={onNavigate} />
      </div>
    </aside>
  );
}
