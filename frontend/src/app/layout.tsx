import type { Metadata, Viewport } from "next";

import { AppPreferencesProvider } from "@/components/providers/app-preferences-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { PageViewTracker } from "@/components/audit/page-view-tracker";
import { ToastProvider } from "@/components/providers/toast-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "BakeOps | 面包店运营管理",
  description: "面包店运营管理平台",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-theme="light" suppressHydrationWarning>
      <body>
        <ToastProvider>
          <AppPreferencesProvider>
            <AuthProvider><PageViewTracker />{children}</AuthProvider>
          </AppPreferencesProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
