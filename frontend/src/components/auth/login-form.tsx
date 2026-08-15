"use client";

import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { AuthShell } from "@/components/auth/auth-shell";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { Button } from "@/components/ui/button";
import { loginUser } from "@/lib/api";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const { locale } = useAppPreferences();
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const isEnglish = locale === "en-GB";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace(nextPath);
  }, [loading, nextPath, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await loginUser({ email, password, remember });
      await refreshUser();
      router.replace(nextPath);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : isEnglish ? "Unable to sign in." : "登录失败，请稍后再试。")
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="mb-8">
        <p className="mb-2 text-sm font-medium text-[var(--primary)]">{isEnglish ? "Welcome back" : "欢迎回来"}</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">{isEnglish ? "Sign in to BakeOps" : "登录 BakeOps"}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{isEnglish ? "Enter your system account to continue to \"Bite Me Loud\" operations." : "使用你的系统账户进入“来咬我啊”运营后台。"}</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">{isEnglish ? "Email address" : "邮箱"}</span>
          <span className="flex h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary-ring)]">
            <Mail className="size-4.5 shrink-0 text-[var(--muted)]" />
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={isEnglish ? "you@example.com" : "请输入邮箱"} />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">{isEnglish ? "Password" : "密码"}</span>
          <span className="flex h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary-ring)]">
            <LockKeyhole className="size-4.5 shrink-0 text-[var(--muted)]" />
            <input required autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={isEnglish ? "Your password" : "请输入密码"} />
            <button type="button" className="grid size-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-muted)]" aria-label={showPassword ? (isEnglish ? "Hide password" : "隐藏密码") : (isEnglish ? "Show password" : "显示密码")} onClick={() => setShowPassword((current) => !current)}>
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </label>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--muted)]">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-4 accent-[var(--primary)]" />
          {isEnglish ? "Remember me for 7 days" : "记住我（7 天免登录）"}
        </label>

        {error ? <p role="alert" className="rounded-xl bg-[var(--danger-soft)] px-3.5 py-3 text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}

        <Button type="submit" className="h-12 w-full" disabled={submitting}>
          {submitting ? (isEnglish ? "Signing in..." : "正在登录...") : (isEnglish ? "Sign in" : "登录")}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-[var(--muted)]">
        {isEnglish ? "Not registered?" : "还未注册？"}{" "}
        <Link href="/register" className="font-medium text-[var(--primary)] hover:underline">{isEnglish ? "Create an account" : "创建账户"}</Link>
      </p>
    </AuthShell>
  );
}
