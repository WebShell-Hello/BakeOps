"use client";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";

export function SystemConfigPage() {
  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <PageBreadcrumb
          fallback={{ zh: "系统配置", en: "System Configuration" }}
        />
      </main>
    </DashboardShell>
  );
}
