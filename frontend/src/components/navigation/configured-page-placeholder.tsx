"use client";

import { Construction } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { Card } from "@/components/ui/card";

export function ConfiguredPagePlaceholder({ path }: { path: string }) {
  const { locale } = useAppPreferences();
  const isEnglish = locale === "en-GB";

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-6">
          <PageBreadcrumb />
        </header>
        <Card className="grid min-h-[420px] place-items-center p-8 text-center">
          <div>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
              <Construction className="size-6" />
            </span>
            <h1 className="mt-5 text-2xl font-bold">{isEnglish ? "Page configured" : "页面已配置"}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {isEnglish
                ? "This route is enabled through Menu Management. Its business features will be added in the relevant milestone."
                : "该前端路径已通过菜单管理启用，业务功能将在对应开发阶段接入。"}
            </p>
            <code className="mt-5 inline-block rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs">{path}</code>
          </div>
        </Card>
      </main>
    </DashboardShell>
  );
}
