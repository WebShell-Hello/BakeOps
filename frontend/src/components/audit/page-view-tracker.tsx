"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { recordPageView } from "@/lib/audit-api";

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    void recordPageView(pathname).catch(() => undefined);
  }, [pathname]);

  return null;
}
