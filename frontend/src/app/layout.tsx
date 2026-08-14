import type { Metadata, Viewport } from "next";

import { AppPreferencesProvider } from "@/components/providers/app-preferences-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
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

const initialisePreferences = `
try {
  const theme = localStorage.getItem("bakeops-theme");
  const locale = localStorage.getItem("bakeops-locale");
  document.documentElement.dataset.theme = theme === "dark" || theme === "bakery" || theme === "pink" ? theme : "light";
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
  document.documentElement.lang = locale === "en-GB" ? "en-GB" : "zh-CN";
} catch (_) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initialisePreferences }} />
      </head>
      <body>
        <ToastProvider>
          <AppPreferencesProvider>
            <AuthProvider>{children}</AuthProvider>
          </AppPreferencesProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
