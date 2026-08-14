"use client";

import { KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { type FormEvent, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changeCurrentUserPassword, updateCurrentUserProfile } from "@/lib/api";

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { locale } = useAppPreferences();
  const { showSuccess } = useToast();
  const isEnglish = locale === "en-GB";
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [profileError, setProfileError] = useState("");

  async function handleProfileUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSubmittingProfile(true);
    setProfileError("");
    try {
      await updateCurrentUserProfile({
        username: String(formData.get("username") || ""),
        first_name: String(formData.get("first_name") || ""),
        last_name: String(formData.get("last_name") || ""),
      });
      await refreshUser();
      showSuccess(isEnglish ? "Account details updated" : "账户信息已更新");
    } catch (requestError) {
      setProfileError(requestError instanceof Error ? requestError.message : isEnglish ? "Unable to update account details." : "账户信息更新失败。");
    } finally {
      setSubmittingProfile(false);
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingPassword(true);
    setPasswordError("");
    try {
      await changeCurrentUserPassword(passwords);
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      showSuccess(isEnglish ? "Password updated" : "密码已修改");
    } catch (requestError) {
      setPasswordError(requestError instanceof Error ? requestError.message : isEnglish ? "Unable to update password." : "密码修改失败。");
    } finally {
      setSubmittingPassword(false);
    }
  }

  const readOnlyFields = [
    { icon: Mail, label: isEnglish ? "Email" : "邮箱", value: user?.email || "—" },
    { icon: ShieldCheck, label: isEnglish ? "Roles" : "角色", value: user?.is_superuser ? (isEnglish ? "Super administrator" : "超级管理员") : user?.role_names.join(isEnglish ? ", " : "、") || (isEnglish ? "No role assigned" : "暂未配置角色") },
  ];

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 xl:p-9">
        <header className="mb-7">
          <PageBreadcrumb fallback={{ zh: "个人信息", en: "Personal information" }} />
          <p className="mt-1.5 text-sm text-[var(--muted)]">{isEnglish ? "Update your account details and sign-in password." : "修改账户资料和登录密码。"}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>{isEnglish ? "Account details" : "账户信息"}</CardTitle></CardHeader>
            <CardContent>
              <form key={`${user?.username}:${user?.first_name}:${user?.last_name}`} className="space-y-4" onSubmit={handleProfileUpdate}>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">{isEnglish ? "Username" : "用户名"}</span>
                  <span className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary-ring)]">
                    <UserRound className="size-4.5 shrink-0 text-[var(--muted)]" />
                    <input required name="username" autoComplete="username" defaultValue={user?.username} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  </span>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(isEnglish
                    ? [["first_name", "First name", "given-name"], ["last_name", "Last name", "family-name"]]
                    : [["last_name", "姓", "family-name"], ["first_name", "名", "given-name"]]
                  ).map(([key, label, autoComplete]) => (
                    <label key={key} className="block">
                      <span className="mb-1.5 block text-sm font-medium">{label}</span>
                      <input required name={key} autoComplete={autoComplete} defaultValue={user?.[key as "first_name" | "last_name"]} className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]" />
                    </label>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {readOnlyFields.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex min-w-0 items-start gap-3 rounded-xl bg-[var(--surface-muted)] p-3.5">
                      <Icon className="mt-0.5 size-4.5 shrink-0 text-[var(--muted)]" />
                      <div className="min-w-0"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-1 break-words text-sm font-medium">{value}</p></div>
                    </div>
                  ))}
                </div>
                {profileError ? <p role="alert" className="rounded-xl bg-[var(--danger-soft)] px-3.5 py-3 text-sm text-rose-600">{profileError}</p> : null}
                <Button type="submit" disabled={submittingProfile}>{submittingProfile ? (isEnglish ? "Saving..." : "正在保存...") : (isEnglish ? "Save account details" : "保存账户信息")}</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="size-5 text-[var(--primary)]" />{isEnglish ? "Change password" : "修改密码"}</CardTitle></CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handlePasswordChange}>
                {([
                  ["current_password", isEnglish ? "Current password" : "当前密码", "current-password"],
                  ["new_password", isEnglish ? "New password" : "新密码", "new-password"],
                  ["confirm_password", isEnglish ? "Confirm new password" : "确认新密码", "new-password"],
                ] as const).map(([key, label, autoComplete]) => (
                  <label key={key} className="block">
                    <span className="mb-1.5 block text-sm font-medium">{label}</span>
                    <input required type="password" autoComplete={autoComplete} value={passwords[key]} onChange={(event) => setPasswords((current) => ({ ...current, [key]: event.target.value }))} className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]" />
                  </label>
                ))}
                {passwordError ? <p role="alert" className="rounded-xl bg-[var(--danger-soft)] px-3.5 py-3 text-sm text-rose-600">{passwordError}</p> : null}
                <Button type="submit" className="w-full sm:w-auto" disabled={submittingPassword}>{submittingPassword ? (isEnglish ? "Updating..." : "正在修改...") : (isEnglish ? "Update password" : "保存新密码")}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </DashboardShell>
  );
}
