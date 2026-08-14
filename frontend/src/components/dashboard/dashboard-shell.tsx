"use client";

import { X } from "lucide-react";
import { createContext, type FocusEvent, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

import { AppSidebar, type SidebarMode } from "@/components/dashboard/app-sidebar";
import { AppTopbar } from "@/components/dashboard/app-topbar";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { Button } from "@/components/ui/button";
import { useNavigationTree } from "@/hooks/use-navigation-tree";
import type { NavigationTree } from "@/lib/api";
import { cn } from "@/lib/utils";

type DashboardNavigationContextValue = {
  tree: NavigationTree | null;
  loading: boolean;
};

const DashboardNavigationContext = createContext<DashboardNavigationContextValue | null>(null);

export function useDashboardNavigation() {
  const context = useContext(DashboardNavigationContext);
  if (!context) throw new Error("useDashboardNavigation must be used inside DashboardShell");
  return context;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { locale, sidebarPinned, setSidebarPinned } = useAppPreferences();
  const isEnglish = locale === "en-GB";
  const { tree: navigationTree, loading: navigationLoading, error: navigationError } = useNavigationTree();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarMode: SidebarMode = sidebarPinned ? "pinned" : "auto";
  const [autoHovered, setAutoHovered] = useState(false);
  const [autoFocused, setAutoFocused] = useState(false);
  const sidebarModeRef = useRef(sidebarMode);
  const navigationContext = useMemo(
    () => ({ tree: navigationTree, loading: navigationLoading }),
    [navigationTree, navigationLoading],
  );

  const desktopSidebarExpanded = sidebarMode === "pinned" || (sidebarMode === "auto" && (autoHovered || autoFocused));

  useEffect(() => {
    sidebarModeRef.current = sidebarMode;
  }, [sidebarMode]);

  function updateSidebarMode(mode: SidebarMode) {
    sidebarModeRef.current = mode;
    setSidebarPinned(mode === "pinned");
  }

  function handleSidebarMouseLeave() {
    if (sidebarModeRef.current !== "auto") return;
    setAutoHovered(false);
    setAutoFocused(false);
  }

  function handleSidebarBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setAutoFocused(false);
    }
  }

  return (
    <DashboardNavigationContext.Provider value={navigationContext}>
    <div className="viewport-shell bg-[var(--background)]">
      <AppSidebar
        mode={sidebarMode}
        expanded={desktopSidebarExpanded}
        items={navigationTree?.items ?? []}
        loading={navigationLoading}
        error={navigationError}
        onModeChange={updateSidebarMode}
        onMouseEnter={() => setAutoHovered(true)}
        onMouseLeave={handleSidebarMouseLeave}
        onFocusCapture={() => setAutoFocused(true)}
        onBlurCapture={handleSidebarBlur}
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden lg:flex",
          sidebarMode === "auto" && desktopSidebarExpanded && "shadow-2xl",
        )}
      />

      {mobileSidebarOpen ? (
        <div className="mobile-sidebar-layer fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={isEnglish ? "Close navigation overlay" : "关闭导航遮罩"}
            className="safari-backdrop absolute inset-0 bg-slate-950/25"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <AppSidebar
            mobile
            expanded
            items={navigationTree?.items ?? []}
            loading={navigationLoading}
            error={navigationError}
            className="relative z-10 shadow-2xl"
            onNavigate={() => setMobileSidebarOpen(false)}
          />
          <Button
            type="button"
            aria-label={isEnglish ? "Close navigation" : "关闭导航"}
            variant="outline"
            size="icon"
            className="absolute top-5 left-[248px] z-20"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X className="size-5" />
          </Button>
        </div>
      ) : null}

      <AppTopbar
        desktopSidebarPinned={sidebarMode === "pinned"}
        onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
      />

      <div
        className={cn(
          "transition-[padding] duration-200 ease-out",
          sidebarMode === "pinned" ? "lg:pl-[236px]" : "lg:pl-[76px]",
        )}
      >
        <div className="dashboard-content">{children}</div>
      </div>
    </div>
    </DashboardNavigationContext.Provider>
  );
}
