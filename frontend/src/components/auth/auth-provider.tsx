"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import {
  getCurrentUser,
  getNavigationTree,
  logoutUser,
  type AuthUser,
  type NavigationTreeItem,
} from "@/lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refreshUser: () => Promise<AuthUser | null>;
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

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      syncAccountPreferences(currentUser.preferences);
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      clearAccountPreferences();
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearAccountPreferences, syncAccountPreferences]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshUser();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshUser]);

  useEffect(() => {
    if (loading || user || publicRoutes.has(pathname)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void getNavigationTree()
        .then((tree) => {
          if (cancelled || anonymousCanAccessPath(pathname, tree.items)) return;
          const next = `?next=${encodeURIComponent(pathname)}`;
          router.replace(`/login${next}`);
        })
        .catch(() => {
          if (cancelled) return;
          const next = `?next=${encodeURIComponent(pathname)}`;
          router.replace(`/login${next}`);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading, pathname, router, user]);

  const signOut = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      setUser(null);
      clearAccountPreferences();
      router.replace("/");
      router.refresh();
    }
  }, [clearAccountPreferences, router]);

  const value = useMemo(
    () => ({ user, loading, refreshUser, signOut }),
    [loading, refreshUser, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
