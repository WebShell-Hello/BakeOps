"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { setAuthenticated, setAuthReady, setDataMode } from "@/lib/data-mode";
import {
  getCurrentUser,
  getNavigationTree,
  logoutUser,
  type AuthUser,
  type NavigationTreeItem,
} from "@/lib/api";

const AUTH_SYNC_STORAGE_KEY = "bakeops-auth-sync";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refreshUser: () => Promise<AuthUser | null>;
  notifyAuthChange: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const publicRoutes = new Set(["/", "/login", "/register"]);

function anonymousCanAccessPath(pathname: string, items: NavigationTreeItem[]) {
  for (const item of items) {
    if (item.frontend_path === pathname) return true;
    if (anonymousCanAccessPath(pathname, item.children)) return true;
  }
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { clearAccountPreferences, syncAccountPreferences } = useAppPreferences();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [guestRoute, setGuestRoute] = useState<{ pathname: string; allowed: boolean } | null>(null);

  const notifyAuthChange = useCallback(() => {
    try {
      window.localStorage.setItem(AUTH_SYNC_STORAGE_KEY, String(Date.now()));
    } catch {
      // Storage can be unavailable in private browsing; the current tab still updates locally.
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      syncAccountPreferences(currentUser.preferences);
      setAuthenticated(true);
      setDataMode(currentUser.system_mode);
      setAuthReady(true);
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      setAuthenticated(false);
      setAuthReady(true);
      setDataMode("TEST");
      clearAccountPreferences();
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearAccountPreferences, syncAccountPreferences]);

  useEffect(() => {
    setAuthReady(false);
    const timer = window.setTimeout(() => {
      void refreshUser();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshUser]);

  useEffect(() => {
    if (loading || signingOut || user || publicRoutes.has(pathname)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void getNavigationTree()
        .then((tree) => {
          if (cancelled) return;
          const allowed = anonymousCanAccessPath(pathname, tree.items);
          setGuestRoute({ pathname, allowed });
          if (!allowed) {
            const next = `?next=${encodeURIComponent(pathname)}`;
            router.replace(`/login${next}`);
          }
        })
        .catch(() => {
          if (cancelled) return;
          setGuestRoute({ pathname, allowed: false });
          const next = `?next=${encodeURIComponent(pathname)}`;
          router.replace(`/login${next}`);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading, pathname, router, signingOut, user]);

  useEffect(() => {
    function handleAuthStorage(event: StorageEvent) {
      if (event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return;
      void refreshUser();
    }
    window.addEventListener("storage", handleAuthStorage);
    return () => window.removeEventListener("storage", handleAuthStorage);
  }, [refreshUser]);

  const signOut = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      setSigningOut(true);
      setUser(null);
      setAuthenticated(false);
      setAuthReady(true);
      setDataMode("TEST");
      clearAccountPreferences();
      notifyAuthChange();
      router.replace("/");
      router.refresh();
    }
  }, [clearAccountPreferences, notifyAuthChange, router]);

  const value = useMemo(
    () => ({ user, loading, refreshUser, notifyAuthChange, signOut }),
    [loading, notifyAuthChange, refreshUser, signOut, user],
  );
  const currentGuestRoute = guestRoute?.pathname === pathname ? guestRoute : null;
  const shouldBlockProtectedGuestRoute =
    !loading &&
    !signingOut &&
    !user &&
    !publicRoutes.has(pathname) &&
    currentGuestRoute?.allowed !== true;

  return <AuthContext.Provider value={value}>{shouldBlockProtectedGuestRoute ? null : children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
