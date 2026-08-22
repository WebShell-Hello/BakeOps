"use client";

import { ClipboardList, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataPagination } from "@/components/ui/data-pagination";
import { getAuditLogs, type AuditLogKind, type AuditLogRecord } from "@/lib/audit-api";

const copy = {
  "zh-CN": {
    title: "日志管理",
    description: "查看用户、游客的访问记录和系统操作审计",
    access: "访问日志",
    audit: "操作审计",
    search: "搜索路径、资源或用户",
    searchButton: "搜索",
    clear: "清除",
    actor: "主体",
    email: "邮箱",
    systemMode: "系统模式",
    testMode: "测试模式",
    productionMode: "生产模式",
    unknownMode: "未记录",
    all: "全部",
    user: "用户",
    guest: "游客",
    refresh: "刷新",
    time: "时间",
    action: "操作",
    menu: "菜单",
    target: "对象",
    path: "技术路径",
    device: "设备",
    result: "结果",
    success: "成功",
    failed: "失败",
    empty: "暂无日志记录",
    loading: "正在加载日志...",
    error: "日志加载失败",
  },
  "en-GB": {
    title: "Audit Logs",
    description: "Review user and guest access records and system actions",
    access: "Access logs",
    audit: "Action audit",
    search: "Search paths, resources or users",
    searchButton: "Search",
    clear: "Clear",
    actor: "Actor",
    email: "Email",
    systemMode: "System mode",
    testMode: "Test mode",
    productionMode: "Production mode",
    unknownMode: "Not recorded",
    all: "All",
    user: "User",
    guest: "Guest",
    refresh: "Refresh",
    time: "Time",
    action: "Operation",
    menu: "Menu",
    target: "Target",
    path: "Technical path",
    device: "Device",
    result: "Result",
    success: "Success",
    failed: "Failed",
    empty: "No log records",
    loading: "Loading logs...",
    error: "Unable to load logs",
  },
} as const;

function formatDate(value: string, locale: "zh-CN" | "en-GB") {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const datePart =
    locale === "zh-CN"
      ? `${get("year")}/${get("month")}/${get("day")}`
      : `${get("day")}/${get("month")}/${get("year")}`;
  return `${datePart} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export function AuditLogsPage() {
  const { locale } = useAppPreferences();
  const text = copy[locale];
  const [kind, setKind] = useState<AuditLogKind>("access");
  const [actor, setActor] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await getAuditLogs(kind, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        actor_type: actor,
        search: query,
      });
      setLogs(response.results);
      setTotalLogs(response.count);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [actor, kind, page, pageSize, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <PageBreadcrumb fallback={{ zh: text.title, en: text.title }} />
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              {text.description}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            {text.refresh}
          </Button>
        </header>

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant={kind === "access" ? "default" : "outline"}
                onClick={() => {
                  setPage(1);
                  setKind("access");
                }}
              >
                <ClipboardList className="size-4" />
                {text.access}
              </Button>
              <Button
                type="button"
                variant={kind === "audit" ? "default" : "outline"}
                onClick={() => {
                  setPage(1);
                  setKind("audit");
                }}
              >
                <ShieldCheck className="size-4" />
                {text.audit}
              </Button>
            </div>

            <form
              className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-3xl xl:justify-end"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setQuery(search.trim());
              }}
            >
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                  placeholder={text.search}
                  aria-label={text.search}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <select
                className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                aria-label={text.actor}
                value={actor}
                onChange={(event) => {
                  setPage(1);
                  setActor(event.target.value);
                }}
              >
                <option value="">
                  {text.actor}: {text.all}
                </option>
                <option value="USER">{text.user}</option>
                <option value="GUEST">{text.guest}</option>
              </select>
              <Button type="submit" variant="outline">
                <Search className="size-4" />
                {text.searchButton}
              </Button>
              {query ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                    setQuery("");
                  }}
                >
                  {text.clear}
                </Button>
              ) : null}
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1440px] border-collapse text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="w-[154px] px-3 py-3">{text.time}</th>
                  <th className="px-4 py-3">{text.actor}</th>
                  <th className="px-4 py-3">{text.email}</th>
                  <th className="w-[116px] px-4 py-3">{text.systemMode}</th>
                  <th className="px-4 py-3">{text.menu}</th>
                  <th className="px-4 py-3">{text.action}</th>
                  <th className="px-4 py-3">{text.target}</th>
                  <th className="px-4 py-3">{text.device}</th>
                  <th className="px-4 py-3">{text.path}</th>
                  <th className="px-4 py-3">{text.result}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center text-[var(--muted)]">
                      {text.loading}
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center text-rose-500">
                      {text.error}
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center text-[var(--muted)]">
                      {text.empty}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-t border-[var(--border)] align-top transition-colors hover:bg-[var(--surface-muted)]"
                    >
                      <td className="w-[154px] whitespace-nowrap px-3 py-3 text-xs text-[var(--muted)]">
                        {formatDate(log.created_at, locale)}
                      </td>
                      <td className="px-4 py-3">
                        {log.actor_type === "GUEST"
                          ? text.guest
                          : log.user_name || text.user}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {log.user_email || "-"}
                      </td>
                      <td className="w-[116px] px-4 py-3">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${
                            log.system_mode === "PRODUCTION"
                              ? "bg-rose-50 text-rose-700"
                              : log.system_mode === "TEST"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-[var(--surface-muted)] text-[var(--muted)]"
                          }`}
                        >
                          {log.system_mode === "PRODUCTION"
                            ? text.productionMode
                            : log.system_mode === "TEST"
                              ? text.testMode
                              : text.unknownMode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {locale === "en-GB" ? log.menu_name_en : log.menu_name_zh}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {locale === "en-GB"
                          ? log.action_label_en
                          : log.action_label_zh}
                      </td>
                      <td className="px-4 py-3">
                        {locale === "en-GB"
                          ? log.resource_label_en
                          : log.resource_label_zh}
                      </td>
                      <td className="px-4 py-3">
                        {[log.os_family, log.device_type]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </td>
                      <td
                        className="max-w-[240px] truncate px-4 py-3 font-mono text-xs"
                        title={log.path}
                      >
                        {log.path}
                      </td>
                      <td
                        className={`px-4 py-3 ${
                          log.success ? "text-emerald-600" : "text-rose-500"
                        }`}
                      >
                        {log.success
                          ? text.success
                          : `${text.failed} (${log.status_code})`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DataPagination
            locale={locale}
            page={page}
            pageSize={pageSize}
            pageCount={Math.max(1, Math.ceil(totalLogs / pageSize))}
            totalItems={totalLogs}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPage(1);
              setPageSize(nextPageSize);
            }}
          />
        </Card>
      </main>
    </DashboardShell>
  );
}
