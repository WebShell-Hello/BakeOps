"use client";

import { useCallback, useEffect, useState } from "react";

import { getNavigationTree, type NavigationTree } from "@/lib/api";

export const NAVIGATION_CHANGED_EVENT = "bakeops-navigation-changed";

export function notifyNavigationChanged() {
  window.dispatchEvent(new Event(NAVIGATION_CHANGED_EVENT));
}

export function useNavigationTree(code = "main-sidebar") {
  const [tree, setTree] = useState<NavigationTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTree = useCallback(async () => {
    try {
      setError(null);
      const nextTree = await getNavigationTree(code);
      setTree(nextTree);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load navigation");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadTree(), 0);
    window.addEventListener(NAVIGATION_CHANGED_EVENT, loadTree);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener(NAVIGATION_CHANGED_EVENT, loadTree);
    };
  }, [loadTree]);

  return { tree, loading, error, reload: loadTree };
}
