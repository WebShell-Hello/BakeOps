"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { getCurrentUser, logoutUser, type AuthUser } from "@/lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refreshUser: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const publicRoutes = new Set(["/login", "/register"]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const initialPathRef = useRef(pathname);
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
      void refreshUser().then((currentUser) => {
        const initialPath = initialPathRef.current;
        if (!currentUser && !publicRoutes.has(initialPath)) {
          const next = initialPath === "/" ? "" : `?next=${encodeURIComponent(initialPath)}`;
          router.replace(`/login${next}`);
        }
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshUser, router]);

  const signOut = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      setUser(null);
      clearAccountPreferences();
      router.replace("/login");
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
