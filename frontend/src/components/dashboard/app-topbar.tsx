"use client";

import {
  Check,
  CircleHelp,
  Languages,
  Linkedin,
  Mail,
  Menu,
  Palette,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { UserMenu } from "@/components/auth/user-menu";
import { TopbarGlobalSearch } from "@/components/dashboard/topbar-global-search";
import { TopbarNotifications } from "@/components/dashboard/topbar-notifications";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { Button } from "@/components/ui/button";
import type { NavigationTreeItem } from "@/lib/api";
import { cn } from "@/lib/utils";

type AppTopbarProps = {
  desktopSidebarPinned: boolean;
  navigationItems: NavigationTreeItem[];
  onOpenMobileSidebar: () => void;
};

export function AppTopbar({
  desktopSidebarPinned,
  navigationItems,
  onOpenMobileSidebar,
}: AppTopbarProps) {
  const { locale, theme, setTheme, toggleLocale } = useAppPreferences();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const isEnglish = locale === "en-GB";
  const themeMenuLabel = isEnglish ? "Choose colour theme" : "选择颜色风格";
  const themeOptions = [
    { id: "light", zh: "浅色", en: "Light", swatch: "#0071e3" },
    { id: "dark", zh: "深色", en: "Dark", swatch: "#35393f" },
    {
      id: "bakery",
      zh: "来咬我啊",
      en: "bitemeloud",
      swatch: "conic-gradient(#fff200 0 25%, #fe6844 25% 50%, #64beeb 50% 75%, #0a2535 75%)",
    },
    { id: "pink", zh: "公主粉", en: "Princess Pink", swatch: "#d97b99" },
  ] as const;

  useEffect(() => {
    function closeThemeMenu(event: MouseEvent) {
      if (!themeMenuRef.current?.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
    }

    function closeThemeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setThemeMenuOpen(false);
    }

    document.addEventListener("mousedown", closeThemeMenu);
    document.addEventListener("keydown", closeThemeMenuOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeThemeMenu);
      document.removeEventListener("keydown", closeThemeMenuOnEscape);
    };
  }, []);

  return (
    <>
      <header
        data-app-topbar
        className={cn(
          "app-topbar safari-backdrop fixed top-0 right-0 left-0 z-20 flex items-center border-b border-[var(--border)] px-4 transition-[left] duration-200 ease-out sm:px-6",
          desktopSidebarPinned ? "lg:left-[236px]" : "lg:left-[76px]",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 lg:hidden"
            aria-label={isEnglish ? "Open navigation" : "打开导航"}
            onClick={onOpenMobileSidebar}
          >
            <Menu className="size-5" />
          </Button>

          <p className="truncate text-sm font-bold sm:text-[15px]">
            {isEnglish ? (
              <>
                BITE ME L<span className="text-red-600">OD</span>
              </>
            ) : (
              "来咬我啊"
            )}
          </p>
        </div>

        <TopbarGlobalSearch locale={locale} navigationItems={navigationItems} />

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div ref={themeMenuRef} className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label={themeMenuLabel}
              title={themeMenuLabel}
              aria-haspopup="menu"
              aria-expanded={themeMenuOpen}
              data-current-theme={theme}
              onClick={() => setThemeMenuOpen((current) => !current)}
            >
              <Palette className="size-[18px]" />
            </Button>
            {themeMenuOpen ? (
              <div
                role="menu"
                className="absolute top-11 right-0 z-50 w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-xl"
              >
                {themeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={theme === option.id}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-muted)]",
                      theme === option.id && "bg-[var(--primary-soft)]",
                    )}
                    onClick={() => {
                      setTheme(option.id);
                      setThemeMenuOpen(false);
                    }}
                  >
                    <span
                      className="size-4 rounded-full border border-black/10 shadow-sm"
                      style={{ background: option.swatch }}
                    />
                    <span className="flex-1">
                      {isEnglish ? option.en : option.zh}
                    </span>
                    {theme === option.id ? <Check className="size-4" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative size-9"
            aria-label={isEnglish ? "切换为中文" : "Switch to English"}
            title={isEnglish ? "切换为中文" : "Switch to English"}
            onClick={toggleLocale}
          >
            <Languages className="size-[18px]" />
            <span className="absolute right-0.5 bottom-0.5 text-[8px] font-bold leading-none text-[var(--primary)]">
              {isEnglish ? "中" : "EN"}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={isEnglish ? "About this project" : "关于本项目"}
            title={isEnglish ? "About this project" : "关于本项目"}
            onClick={() => setAboutOpen(true)}
          >
            <CircleHelp className="size-[18px]" />
          </Button>
          <TopbarNotifications locale={locale} />
          <UserMenu placement="topbar" />
        </div>
      </header>

      {aboutOpen ? (
        <AboutProjectDialog
          isEnglish={isEnglish}
          onClose={() => setAboutOpen(false)}
        />
      ) : null}
    </>
  );
}

function AboutProjectDialog({
  isEnglish,
  onClose,
}: {
  isEnglish: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    const closeDelay = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 20
      : 180;
    closeTimerRef.current = window.setTimeout(onClose, closeDelay);
  }, [closing, onClose]);

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [requestClose]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null)
        window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center p-4 sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        aria-label={isEnglish ? "Close about dialog" : "关闭关于弹窗"}
        className={cn(
          "absolute inset-0 bg-slate-950/20",
          closing ? "about-overlay-exit" : "about-overlay-enter",
        )}
        onClick={requestClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-project-title"
        tabIndex={-1}
        className={cn(
          "about-dialog relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl outline-none",
          closing ? "about-dialog-exit" : "about-dialog-enter",
        )}
      >
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
              <CircleHelp className="size-5" />
            </span>
            <h2 id="about-project-title" className="text-lg font-semibold">
              {isEnglish ? "About this project" : "关于本项目"}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={isEnglish ? "Close" : "关闭"}
            onClick={requestClose}
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="space-y-6 px-5 py-5 text-sm leading-7 sm:px-6 sm:py-6">
          <p>
            {isEnglish
              ? "This restaurant operations monitoring system is designed for BingBing to practise operations management."
              : "本餐饮运营监控系统，用于BingBing练习运营管理。"}
          </p>

          <section className="space-y-2">
            <h3 className="font-semibold text-[var(--foreground)]">
              {isEnglish ? "Creator & contact" : "创建者与联系"}
            </h3>
            <p>
              {isEnglish
                ? "This project was designed and developed by independent developer Joe Jiaqiao Wan."
                : "本项目由独立开发者 Joe Jiaqiao Wan 设计与开发。"}
            </p>
            <p>
              {isEnglish
                ? "Joe holds an MSc in Big Data and High Performance Computing from the University of Liverpool. His primary areas of focus are data engineering, data analysis, data visualisation and web development."
                : "Joe 拥有利物浦大学大数据与高性能计算理学硕士学位，主要专注于数据工程、数据分析、数据可视化与 Web 开发。"}
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold text-[var(--foreground)]">
              {isEnglish ? "Contact details" : "联系方式"}
            </h3>
            <div className="grid gap-2">
              <a
                href="https://www.linkedin.com/in/joe-jiaqiao-wan/"
                target="_blank"
                rel="noreferrer noopener"
                className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3 text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)]"
              >
                <Linkedin className="size-4 shrink-0" />
                <span className="min-w-0 truncate">
                  linkedin.com/in/joe-jiaqiao-wan
                </span>
              </a>
              <a
                href="mailto:joe.jiaqiao.wan@gmail.com"
                className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3 text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)]"
              >
                <Mail className="size-4 shrink-0" />
                <span className="min-w-0 truncate">
                  joe.jiaqiao.wan@gmail.com
                </span>
              </a>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
