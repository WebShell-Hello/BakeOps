export type DataMode = "TEST" | "PRODUCTION";

export const DATA_MODE_SYNC_EVENT = "bakeops-data-mode-sync";
const DATA_MODE_KEY = "bakeops-data-mode";
const AUTHENTICATED_KEY = "bakeops-authenticated";
const AUTH_READY_KEY = "bakeops-auth-ready";

export function getDataMode(): DataMode {
  if (typeof window === "undefined") return "TEST";
  if (window.localStorage.getItem(AUTHENTICATED_KEY) !== "true") return "TEST";
  return window.localStorage.getItem(DATA_MODE_KEY) === "PRODUCTION" ? "PRODUCTION" : "TEST";
}

export function setDataMode(mode: DataMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DATA_MODE_KEY, mode);
  window.dispatchEvent(new Event(DATA_MODE_SYNC_EVENT));
}

export function setAuthenticated(value: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTHENTICATED_KEY, value ? "true" : "false");
}

export function setAuthReady(value: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_READY_KEY, value ? "true" : "false");
}

export function isAuthenticatedLocally(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(AUTH_READY_KEY) === "true" && window.localStorage.getItem(AUTHENTICATED_KEY) === "true";
}
