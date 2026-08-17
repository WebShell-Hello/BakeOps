"use client";

import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { useAuth } from "@/components/auth/auth-provider";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { NavigationIcon } from "@/components/navigation/navigation-icon";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { Card } from "@/components/ui/card";
import { useNavigationTree } from "@/hooks/use-navigation-tree";
import type { NavigationTreeItem } from "@/lib/api";

export function HomeGate() {
  const { locale } = useAppPreferences();
  const { user, loading: authLoading } = useAuth();
  const { tree, loading: navigationLoading } = useNavigationTree();
  const isEnglish = locale === "en-GB";

  if (authLoading || navigationLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-[var(--muted)]">
        {isEnglish ? "Loading..." : "正在加载..."}
      </div>
    );
  }

  if (user) return <DashboardPage />;
  if (!tree?.items.length) return <LoginForm nextPath="/" />;
  return <AnonymousSystemPage items={tree.items} />;
}

function AnonymousSystemPage({ items }: { items: NavigationTreeItem[] }) {
  const { locale } = useAppPreferences();
  const isEnglish = locale === "en-GB";
  const pages = flattenPages(items);

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <PageBreadcrumb
              fallback={{
                zh: "未登录可见页面",
                en: "Public system pages",
              }}
            />
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              {isEnglish
                ? "These pages are visible before signing in."
                : "以下页面可在未登录时查看。"}
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-4 text-sm font-medium hover:bg-[var(--surface-muted)]"
          >
            <LockKeyhole className="size-4" />
            {isEnglish ? "Sign in" : "登录"}
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pages.map((page) => (
            <Link key={page.id} href={page.frontend_path ?? "/"}>
              <Card className="group flex h-full items-start gap-4 p-4 transition-colors hover:border-[var(--primary-border)] hover:bg-[var(--primary-soft)]">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--surface-muted)] text-[var(--primary)]">
                  <NavigationIcon iconKey={page.icon_key} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {isEnglish ? page.label_en : page.label_zh}
                  </span>
                  <code className="mt-1 block truncate text-xs text-[var(--muted)]">
                    {page.frontend_path}
                  </code>
                </span>
                <ArrowRight className="mt-1 size-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
              </Card>
            </Link>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}

function flattenPages(items: NavigationTreeItem[]): NavigationTreeItem[] {
  return items.flatMap((item) => {
    if (item.item_type === "PAGE") return [item];
    return flattenPages(item.children);
  });
}
