"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import { useToast } from "@/components/providers/toast-provider";
import { updateCurrentUserPreferences, type UserPreferences } from "@/lib/api";

export type AppTheme = "light" | "dark" | "bakery" | "pink";
export type AppLocale = "zh-CN" | "en-GB";

const THEME_STORAGE_KEY = "bakeops-theme";
const LOCALE_STORAGE_KEY = "bakeops-locale";
const SIDEBAR_PINNED_STORAGE_KEY = "bakeops-sidebar-pinned";
const PREFERENCES_CHANGE_EVENT = "bakeops-preferences-change";

type AppPreferences = {
  theme: AppTheme;
  locale: AppLocale;
  sidebarPinned: boolean;
  setTheme: (theme: AppTheme) => void;
  setLocale: (locale: AppLocale) => void;
  setSidebarPinned: (pinned: boolean) => void;
  toggleTheme: () => void;
  toggleLocale: () => void;
  syncAccountPreferences: (preferences: UserPreferences) => void;
  clearAccountPreferences: () => void;
};

const AppPreferencesContext = createContext<AppPreferences | null>(null);

function isTheme(value: string | null): value is AppTheme {
  return (
    value === "light" ||
    value === "dark" ||
    value === "bakery" ||
    value === "pink"
  );
}

function isLocale(value: string | null): value is AppLocale {
  return value === "zh-CN" || value === "en-GB";
}

function getThemeSnapshot(): AppTheme {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(savedTheme) ? savedTheme : "light";
}

function getLocaleSnapshot(): AppLocale {
  const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(savedLocale) ? savedLocale : "zh-CN";
}

function getSidebarPinnedSnapshot(): boolean {
  return window.localStorage.getItem(SIDEBAR_PINNED_STORAGE_KEY) !== "false";
}

function subscribeToPreferences(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(PREFERENCES_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PREFERENCES_CHANGE_EVENT, callback);
  };
}

function applyPreferences(theme: AppTheme, locale: AppLocale) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = locale;
  document.documentElement.style.colorScheme =
    theme === "dark" ? "dark" : "light";
}

function savePreferences(theme: AppTheme, locale: AppLocale, sidebarPinned: boolean) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  window.localStorage.setItem(SIDEBAR_PINNED_STORAGE_KEY, String(sidebarPinned));
  applyPreferences(theme, locale);
  window.dispatchEvent(new Event(PREFERENCES_CHANGE_EVENT));
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const { showInfo } = useToast();
  const accountSyncEnabledRef = useRef(false);
  const themeMutationRef = useRef(0);
  const localeMutationRef = useRef(0);
  const sidebarPinnedMutationRef = useRef(0);
  const theme = useSyncExternalStore<AppTheme>(
    subscribeToPreferences,
    getThemeSnapshot,
    () => "light",
  );
  const locale = useSyncExternalStore<AppLocale>(
    subscribeToPreferences,
    getLocaleSnapshot,
    () => "zh-CN",
  );
  const sidebarPinned = useSyncExternalStore<boolean>(
    subscribeToPreferences,
    getSidebarPinnedSnapshot,
    () => true,
  );

  useEffect(() => {
    applyPreferences(theme, locale);
  }, [locale, theme]);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    const previousTheme = theme;
    savePreferences(nextTheme, locale, sidebarPinned);
    if (!accountSyncEnabledRef.current) return;

    themeMutationRef.current += 1;
    const mutation = themeMutationRef.current;
    void updateCurrentUserPreferences({ theme: nextTheme }).catch(() => {
      if (mutation !== themeMutationRef.current) return;
      savePreferences(previousTheme, locale, sidebarPinned);
      showInfo(
        locale === "en-GB"
          ? "Theme could not be saved."
          : "色调保存失败，已恢复原设置。",
      );
    });
  }, [locale, showInfo, sidebarPinned, theme]);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    const previousLocale = locale;
    savePreferences(theme, nextLocale, sidebarPinned);
    if (!accountSyncEnabledRef.current) return;

    localeMutationRef.current += 1;
    const mutation = localeMutationRef.current;
    void updateCurrentUserPreferences({ locale: nextLocale }).catch(() => {
      if (mutation !== localeMutationRef.current) return;
      savePreferences(theme, previousLocale, sidebarPinned);
      showInfo(
        previousLocale === "en-GB"
          ? "Language could not be saved."
          : "语言保存失败，已恢复原设置。",
      );
    });
  }, [locale, showInfo, sidebarPinned, theme]);

  const setSidebarPinned = useCallback((nextSidebarPinned: boolean) => {
    const previousSidebarPinned = sidebarPinned;
    savePreferences(theme, locale, nextSidebarPinned);
    if (!accountSyncEnabledRef.current) return;

    sidebarPinnedMutationRef.current += 1;
    const mutation = sidebarPinnedMutationRef.current;
    void updateCurrentUserPreferences({ sidebar_pinned: nextSidebarPinned }).catch(() => {
      if (mutation !== sidebarPinnedMutationRef.current) return;
      savePreferences(theme, locale, previousSidebarPinned);
      showInfo(
        locale === "en-GB"
          ? "Sidebar preference could not be saved."
          : "侧边栏偏好保存失败，已恢复原设置。",
      );
    });
  }, [locale, showInfo, sidebarPinned, theme]);

  const syncAccountPreferences = useCallback((preferences: UserPreferences) => {
    accountSyncEnabledRef.current = true;
    savePreferences(preferences.theme, preferences.locale, preferences.sidebar_pinned);
  }, []);

  const clearAccountPreferences = useCallback(() => {
    accountSyncEnabledRef.current = false;
  }, []);

  const value = useMemo<AppPreferences>(
    () => ({
      theme,
      locale,
      sidebarPinned,
      setTheme,
      setLocale,
      setSidebarPinned,
      toggleTheme() {
        const nextTheme: AppTheme =
          theme === "light"
            ? "dark"
            : theme === "dark"
              ? "bakery"
              : theme === "bakery"
                ? "pink"
                : "light";
        setTheme(nextTheme);
      },
      toggleLocale() {
        const nextLocale = locale === "zh-CN" ? "en-GB" : "zh-CN";
        setLocale(nextLocale);
      },
      syncAccountPreferences,
      clearAccountPreferences,
    }),
    [
      clearAccountPreferences,
      locale,
      setLocale,
      setSidebarPinned,
      setTheme,
      sidebarPinned,
      syncAccountPreferences,
      theme,
    ],
  );

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const preferences = useContext(AppPreferencesContext);

  if (!preferences) {
    throw new Error(
      "useAppPreferences must be used within AppPreferencesProvider",
    );
  }

  return preferences;
}
