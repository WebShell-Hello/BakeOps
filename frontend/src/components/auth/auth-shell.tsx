"use client";

import { ChefHat, Languages, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { Button } from "@/components/ui/button";

export function AuthShell({ children }: { children: ReactNode }) {
  const { locale, toggleLocale } = useAppPreferences();
  const isEnglish = locale === "en-GB";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[var(--background)] p-4 sm:p-6">
      <div className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-[var(--primary-soft)] blur-3xl" />
      <div className="pointer-events-none absolute -right-28 -bottom-36 size-[30rem] rounded-full bg-[var(--primary-soft)] blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-2xl sm:min-h-[calc(100dvh-3rem)] lg:grid-cols-[1.04fr_.96fr]">
        <section className="flex min-h-full flex-col p-6 sm:p-10 lg:p-12">
          <header className="flex items-center justify-between">
            <Link
              href="/"
              aria-label={isEnglish ? "Go to the guest home page" : "返回游客主页"}
              className="group flex items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ring)]"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary-shadow)] transition-transform group-hover:-translate-y-0.5">
                <ChefHat className="size-6" />
              </span>
              <span>
                <span className="block text-xl font-bold tracking-[-0.03em]">BakeOps</span>
                <span className="block text-xs text-[var(--muted)]">{isEnglish ? "bitemeloud" : "来咬我啊"}</span>
              </span>
            </Link>
            <Button type="button" variant="ghost" size="icon" aria-label={isEnglish ? "切换为中文" : "Switch to English"} onClick={toggleLocale}>
              <Languages className="size-5" />
            </Button>
          </header>

          <div className="my-auto w-full max-w-md self-center py-12">{children}</div>

          <p className="text-center text-xs text-[var(--muted)] sm:text-left">© 2026 BakeOps · {isEnglish ? "Secure operations workspace" : "安全的门店运营工作台"}</p>
        </section>

        <aside className="relative hidden overflow-hidden bg-[var(--auth-panel)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -top-16 -right-16 size-72 rounded-full border border-white/20" />
          <div className="absolute top-24 -right-28 size-96 rounded-full border border-white/10" />
          <div className="relative">
            <span className="mb-7 grid size-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Sparkles className="size-6" />
            </span>
            <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-[-0.04em]">
              {isEnglish ? "Run every day with clarity." : "让每一天的门店运营，都清晰可见。"}
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/75">
              {isEnglish ? "Products, staff, schedules and analytics in one secure workspace." : "将产品、员工、排班和经营分析集中在同一个安全工作台。"}
            </p>
          </div>
          <div className="relative flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <ShieldCheck className="size-6 shrink-0" />
            <p className="text-sm leading-6 text-white/85">{isEnglish ? "Your password is never stored in the browser. Remember me keeps only a secure session for seven days." : "浏览器不会保存密码；“记住我”仅保留 7 天安全登录会话。"}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
