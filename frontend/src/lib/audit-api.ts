import { apiRequest } from "@/lib/api";

export type AuditLogRecord = {
  id: string;
  created_at: string;
  system_mode: "TEST" | "PRODUCTION" | "UNKNOWN";
  actor_type: "USER" | "GUEST" | "SYSTEM";
  user_id: string | null;
  user_name: string;
  user_email: string;
  visitor_id: string | null;
  method: string;
  path: string;
  page_key: string;
  resource_type: string;
  resource_id: string;
  action: string;
  action_label_zh: string;
  action_label_en: string;
  menu_key: string;
  menu_name_zh: string;
  menu_name_en: string;
  resource_label_zh: string;
  resource_label_en: string;
  status_code: number;
  success: boolean;
  reason?: string;
  duration_ms?: number | null;
  ip_hash: string;
  country_code: string;
  region: string;
  city: string;
  device_type: string;
  os_family: string;
  os_version: string;
  browser_family: string;
  browser_version: string;
  user_agent?: string;
  metadata: Record<string, unknown>;
  changed_fields?: Record<string, unknown>;
};

export type AuditLogPage = { count: number; next: string | null; previous: string | null; results: AuditLogRecord[] };
export type AuditLogKind = "access" | "audit";

export function getAuditLogs(kind: AuditLogKind, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") query.set(key, String(value));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<AuditLogPage>(`/audit/${kind}/${suffix}`);
}

export function recordPageView(path: string, pageKey?: string) {
  return apiRequest<void>("/audit/page-views/", {
    method: "POST",
    body: JSON.stringify({ path, page_key: pageKey ?? "" }),
  });
}
