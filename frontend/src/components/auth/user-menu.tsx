"use client";

import { ChevronDown, LogIn, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { cn } from "@/lib/utils";

type UserMenuProps = {
  placement: "topbar" | "sidebar";
  expanded?: boolean;
  onNavigate?: () => void;
};

export function UserMenu({ placement, expanded = true, onNavigate }: UserMenuProps) {
  const { user, signOut } = useAuth();
  const { locale } = useAppPreferences();
  const isEnglish = locale === "en-GB";
  const [open, setOpen] = useState(false);
  const [sidebarMenuStyle, setSidebarMenuStyle] = useState<CSSProperties>();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const accountName = user
    ? isEnglish
      ? [user.first_name, user.last_name].filter(Boolean).join(" ")
      : [user.last_name, user.first_name].filter(Boolean).join("")
    : "";
  const displayName = accountName || user?.username || (isEnglish ? "Account" : "账户");
  const initials = useMemo(() => {
    const source = accountName || user?.username || "A";
    return source.trim().slice(0, 1).toUpperCase();
  }, [accountName, user]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useLayoutEffect(() => {
    if (!open || placement !== "sidebar") return;

    function updateMenuPosition() {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!triggerRect || !menu) return;

      const viewportPadding = 12;
      const gap = 8;
      const preferredLeft = expanded ? triggerRect.left : triggerRect.right + gap;
      const left = Math.min(
        Math.max(viewportPadding, preferredLeft),
        window.innerWidth - menu.offsetWidth - viewportPadding,
      );
      const top = Math.max(viewportPadding, triggerRect.top - menu.offsetHeight - gap);

      setSidebarMenuStyle({ left, top });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [expanded, open, placement]);

  const menu = open ? (
    <div
      ref={menuRef}
      role="menu"
      style={placement === "sidebar" ? sidebarMenuStyle : undefined}
      className={cn(
        "z-[70] w-60 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-2xl",
        placement === "topbar" ? "absolute top-12 right-0" : "fixed",
        placement === "sidebar" && !sidebarMenuStyle && "invisible",
      )}
    >
      <div className="border-b border-[var(--border)] px-3 py-2.5">
        <p className="truncate text-sm font-semibold">{displayName}</p>
        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{user?.email}</p>
      </div>
      {user ? (
        <>
          <Link href="/profile" role="menuitem" className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm hover:bg-[var(--surface-muted)]" onClick={() => { setOpen(false); onNavigate?.(); }}>
            <UserRound className="size-4 text-[var(--muted)]" />
            {isEnglish ? "Personal information" : "个人信息"}
          </Link>
          <button type="button" role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-[var(--danger-soft)]" onClick={() => void signOut()}>
            <LogOut className="size-4" />
            {isEnglish ? "Sign out" : "退出登录"}
          </button>
        </>
      ) : (
        <Link href="/login" role="menuitem" className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm hover:bg-[var(--surface-muted)]" onClick={() => { setOpen(false); onNavigate?.(); }}>
          <LogIn className="size-4 text-[var(--muted)]" />
          {isEnglish ? "Sign in" : "登录"}
        </Link>
      )}
    </div>
  ) : null;

  return (
    <div ref={containerRef} className={cn("relative", placement === "sidebar" && "w-full")}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={!expanded ? displayName : undefined}
        className={cn(
          "flex items-center rounded-xl transition-colors hover:bg-[var(--surface-muted)]",
          placement === "topbar" ? "h-10 gap-2 px-1.5 sm:border-l sm:border-[var(--border)] sm:pl-3" : "w-full py-2",
          placement === "sidebar" && (expanded ? "gap-3 px-2" : "justify-center px-0"),
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-xs font-semibold text-[var(--primary-foreground)]">{initials}</span>
        {expanded ? (
          <>
            <span className={cn("min-w-0 text-left", placement === "sidebar" ? "flex-1" : "hidden xl:block")}>
              <span className="block max-w-28 truncate text-sm font-medium">{displayName}</span>
              {placement === "sidebar" ? <span className="block truncate text-xs text-[var(--muted)]">{user?.is_superuser ? (isEnglish ? "System administrator" : "系统管理员") : (isEnglish ? "System user" : "系统用户")}</span> : null}
            </span>
            <ChevronDown className={cn("size-4 shrink-0 text-[var(--muted)] transition-transform", open && "rotate-180", placement === "topbar" && "hidden xl:block")} />
          </>
        ) : null}
      </button>

      {placement === "sidebar" && menu ? createPortal(menu, document.body) : menu}
    </div>
  );
}
