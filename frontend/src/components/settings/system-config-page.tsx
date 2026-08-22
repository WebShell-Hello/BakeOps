"use client";

import { DatabaseBackup, Download, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { downloadProductionBackup } from "@/lib/api";
import { getDataMode } from "@/lib/data-mode";
import { exportTestData } from "@/lib/local-test-db";
import { cn } from "@/lib/utils";

type BackupContents = "DATA_ONLY" | "DATA_AND_MEDIA";

export function SystemConfigPage() {
  const { locale } = useAppPreferences();
  const { user } = useAuth();
  const { showInfo } = useToast();
  const isEnglish = locale === "en-GB";
  const [backupContents, setBackupContents] = useState<BackupContents>("DATA_ONLY");
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function handleExportTestData() {
    const payload = await exportTestData();
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    downloadBlob(blob, `bakeops-test-data-${new Date().toISOString().replaceAll(":", "-")}.json`);
  }

  async function handleProductionBackup() {
    setDownloadingBackup(true);
    try {
      const { blob, filename } = await downloadProductionBackup(backupContents === "DATA_AND_MEDIA");
      downloadBlob(blob, filename);
      showInfo(isEnglish ? "Production backup downloaded" : "生产数据备份已下载");
    } catch (error) {
      showInfo(
        error instanceof Error
          ? error.message
          : isEnglish
            ? "Unable to download the production backup"
            : "生产数据备份下载失败",
      );
    } finally {
      setDownloadingBackup(false);
    }
  }

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <PageBreadcrumb
          fallback={{ zh: "系统配置", en: "System Configuration" }}
        />
        {user?.can_export_production_backup ? (
          <section className="mt-6 max-w-3xl border-t border-[var(--border)] pt-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <DatabaseBackup className="size-5 text-[var(--primary)]" />
                  <h1 className="text-lg font-semibold">
                    {isEnglish ? "Production data export" : "生产数据导出"}
                  </h1>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  {isEnglish
                    ? "Download all current production data from this server."
                    : "下载当前服务器下的全部生产数据。"}
                </p>
                <div
                  role="radiogroup"
                  aria-label={isEnglish ? "Backup contents" : "备份内容"}
                  className="mt-4 inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-1"
                >
                  {([
                    ["DATA_ONLY", isEnglish ? "Data only" : "仅数据"],
                    ["DATA_AND_MEDIA", isEnglish ? "Data and media files" : "数据和媒体文件"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={backupContents === value}
                      disabled={downloadingBackup}
                      className={cn(
                        "h-8 rounded-md px-3 text-sm font-medium transition-colors",
                        backupContents === value
                          ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                          : "text-[var(--muted)] hover:text-[var(--foreground)]",
                      )}
                      onClick={() => setBackupContents(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                className="shrink-0"
                disabled={downloadingBackup}
                onClick={() => void handleProductionBackup()}
              >
                {downloadingBackup
                  ? <LoaderCircle className="size-4 animate-spin" />
                  : <Download className="size-4" />}
                {isEnglish ? "Back up production data" : "备份生产数据"}
              </Button>
            </div>
          </section>
        ) : null}
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
