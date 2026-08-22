"use client";

import { Download } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { getDataMode } from "@/lib/data-mode";
import { exportTestData } from "@/lib/local-test-db";

export function SystemConfigPage() {
  const { locale } = useAppPreferences();
  const isEnglish = locale === "en-GB";

  async function handleExportTestData() {
    const payload = await exportTestData();
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bakeops-test-data-${new Date().toISOString().replaceAll(":", "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <PageBreadcrumb
          fallback={{ zh: "系统配置", en: "System Configuration" }}
        />
        {getDataMode() === "TEST" ? (
          <section className="mt-6 max-w-3xl border-t border-[var(--border)] pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold">
                  {isEnglish ? "Test data export" : "测试数据导出"}
                </h1>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  {isEnglish
                    ? "Downloads all content from the bakeops-test-data IndexedDB for this browser and domain."
                    : "下载当前浏览器当前域名下 bakeops-test-data IndexedDB 的全部内容。"}
                </p>
              </div>
              <Button
                type="button"
                className="shrink-0"
                onClick={() => void handleExportTestData()}
              >
                <Download className="size-4" />
                {isEnglish ? "Download test data" : "下载测试数据"}
              </Button>
            </div>
          </section>
        ) : null}
      </main>
    </DashboardShell>
  );
}
