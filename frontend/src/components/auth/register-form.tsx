"use client";

import { AtSign, LockKeyhole, Mail, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { AuthShell } from "@/components/auth/auth-shell";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { Button } from "@/components/ui/button";
import { getRegistrationCaptcha, registerUser, type RegistrationCaptcha } from "@/lib/api";

const fieldDefinitions = {
  username: { key: "username", type: "text", autoComplete: "username", icon: AtSign },
  first_name: { key: "first_name", type: "text", autoComplete: "given-name", icon: UserRound },
  last_name: { key: "last_name", type: "text", autoComplete: "family-name", icon: UserRound },
  email: { key: "email", type: "email", autoComplete: "email", icon: Mail },
  password: { key: "password", type: "password", autoComplete: "new-password", icon: LockKeyhole },
} as const;

export function RegisterForm() {
  const { locale } = useAppPreferences();
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const isEnglish = locale === "en-GB";
  const [values, setValues] = useState({ username: "", first_name: "", last_name: "", email: "", password: "", captcha_answer: "" });
  const [captcha, setCaptcha] = useState<RegistrationCaptcha | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, router, user]);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const nextCaptcha = await getRegistrationCaptcha();
      setCaptcha(nextCaptcha);
      setValues((current) => ({ ...current, captcha_answer: "" }));
    } catch (requestError) {
      setCaptcha(null);
      setError(requestError instanceof Error ? requestError.message : isEnglish ? "Unable to load verification code." : "验证码加载失败。");
    } finally {
      setCaptchaLoading(false);
    }
  }, [isEnglish]);

  useEffect(() => {
    if (loading || user) return;
    const timer = window.setTimeout(() => void loadCaptcha(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCaptcha, loading, user]);

  const labels = isEnglish
    ? { username: "Username", first_name: "First name", last_name: "Last name", email: "Email", password: "Password" }
    : { username: "用户名", first_name: "名", last_name: "姓", email: "邮箱", password: "密码" };
  const fields = isEnglish
    ? [fieldDefinitions.username, fieldDefinitions.first_name, fieldDefinitions.last_name, fieldDefinitions.email, fieldDefinitions.password]
    : [fieldDefinitions.username, fieldDefinitions.last_name, fieldDefinitions.first_name, fieldDefinitions.email, fieldDefinitions.password];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (!captcha) throw new Error(isEnglish ? "Please refresh the verification code." : "请刷新验证码后重试。");
      await registerUser({ ...values, captcha_id: captcha.challenge_id });
      await refreshUser();
      router.replace("/");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : isEnglish ? "Unable to register." : "注册失败，请稍后再试。");
      await loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="mb-7">
        <p className="mb-2 text-sm font-medium text-[var(--primary)]">{isEnglish ? "Create your account" : "创建系统账户"}</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">{isEnglish ? "Join BakeOps" : "注册 BakeOps"}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{isEnglish ? "Your account will be stored securely in the BakeOps database." : "账户将安全保存到 BakeOps 数据库中。"}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {fields.map(({ key, type, autoComplete, icon: Icon }) => (
          <label key={key} className="block">
            <span className="mb-1.5 block text-sm font-medium">{labels[key]}</span>
            <span className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary-ring)]">
              <Icon className="size-4.5 shrink-0 text-[var(--muted)]" />
              <input required type={type} autoComplete={autoComplete} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </span>
          </label>
        ))}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{isEnglish ? "Verification code" : "图形验证码"}</span>
          <span className="grid grid-cols-[minmax(0,1fr)_48px] gap-2 sm:grid-cols-[minmax(0,1fr)_150px_48px]">
            <span className="col-span-2 flex h-12 min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary-ring)] sm:col-span-1">
              <ShieldCheck className="size-4.5 shrink-0 text-[var(--muted)]" />
              <input required inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off" aria-label={isEnglish ? "Enter the verification code" : "输入图形验证码"} value={values.captcha_answer} onChange={(event) => setValues((current) => ({ ...current, captcha_answer: event.target.value.replace(/\D/g, "").slice(0, 4) }))} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </span>
            <span className="flex h-12 w-[150px] max-w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[#f4f1ea]">
              {captcha ? <Image unoptimized src={captcha.image_data_url} width={150} height={52} alt={isEnglish ? "Verification code" : "图形验证码"} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-xs text-[var(--muted)]">{isEnglish ? "Unavailable" : "加载失败"}</span>}
            </span>
            <button type="button" aria-label={isEnglish ? "Refresh verification code" : "刷新验证码"} title={isEnglish ? "Refresh verification code" : "刷新验证码"} className="grid size-12 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] transition hover:border-[var(--primary-border)] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50" disabled={captchaLoading} onClick={() => void loadCaptcha()}>
              <RefreshCw className={`size-4.5 ${captchaLoading ? "animate-spin" : ""}`} />
            </button>
          </span>
        </label>

        {error ? <p role="alert" className="rounded-xl bg-[var(--danger-soft)] px-3.5 py-3 text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}

        <Button type="submit" className="h-12 w-full" disabled={submitting || captchaLoading || !captcha || values.captcha_answer.length !== 4}>
          {submitting ? (isEnglish ? "Creating account..." : "正在创建账户...") : (isEnglish ? "Create account" : "注册并进入系统")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        {isEnglish ? "Already registered?" : "已有账户？"}{" "}
        <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">{isEnglish ? "Sign in" : "返回登录"}</Link>
      </p>
    </AuthShell>
  );
}
