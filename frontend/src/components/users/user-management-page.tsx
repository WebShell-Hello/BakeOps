"use client";

import {
  Check,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UnlockKeyhole,
  UserRound,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DataPagination,
  useDataPagination,
} from "@/components/ui/data-pagination";
import {
  bulkDeleteSystemUsers,
  createSystemUser,
  deleteSystemUser,
  getAccessRoles,
  getSystemUsers,
  resetSystemUserPassword,
  setSystemUserLocked,
  updateSystemUser,
  type AccessRole,
  type SystemUser,
  type SystemUserInput,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type UserForm = SystemUserInput;

const emptyForm: UserForm = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  is_active: true,
  is_protected: false,
  role_ids: [],
};

const copy = {
  "zh-CN": {
    parent: "系统设置",
    title: "用户管理",
    description: "管理系统登录用户、账户状态与角色权限",
    add: "添加用户",
    searchPlaceholder: "查找用户名、姓名或邮箱",
    search: "查找",
    clear: "清除",
    username: "用户名",
    email: "邮箱",
    roles: "角色",
    status: "账户状态",
    actions: "操作",
    active: "正常",
    locked: "已锁定",
    superuser: "超级管理员",
    noRole: "未配置角色",
    roleSummary: (roles: number, pages: number) =>
      `${roles} 个角色 · ${pages} 个页面权限`,
    loading: "正在读取系统用户...",
    empty: "没有符合条件的系统用户",
    selected: (count: number) => `已选择 ${count} 个用户`,
    deleteSelected: "删除所选",
    createTitle: "添加系统用户",
    editTitle: "编辑系统用户",
    firstName: "名",
    lastName: "姓",
    passwordHint: "新用户的默认密码为 password123。",
    roleTitle: "配置角色",
    roleHint: "可以选择多个角色，用户最终页面权限取所有角色权限的并集。",
    noAvailableRoles: "暂无可配置角色，请先在角色权限页面新增角色。",
    save: "保存",
    cancel: "取消",
    edit: "编辑",
    resetPassword: "重置密码",
    resetConfirm: (username: string) =>
      `确定重置“${username}”的密码吗？重置后密码将变为 password123。`,
    lock: "锁定账户",
    unlock: "解除锁定",
    delete: "删除",
    protectedUser: "设置为不可删除",
    protectedUserHint: "启用后，单个删除和批量删除都会被后端禁止。",
    deleteConfirm: (count: number) =>
      `确定删除选中的 ${count} 个系统用户吗？此操作无法撤销。`,
    deleteOneConfirm: (username: string) =>
      `确定删除系统用户“${username}”吗？此操作无法撤销。`,
    lockConfirm: (username: string) =>
      `确定锁定“${username}”吗？该用户将无法登录系统。`,
    saved: "用户信息已保存",
    passwordReset: "密码已重置",
    lockedNotice: "账户已锁定",
    unlockedNotice: "账户已解除锁定",
    deletedNotice: "用户已删除",
    loadError: "系统用户加载失败",
    saveError: "用户保存失败，请检查填写内容",
    operationError: "操作失败，请稍后重试",
    protectedHint: "该账户已设置为不可删除",
  },
  "en-GB": {
    parent: "Settings",
    title: "User Management",
    description: "Manage system login users, account status and assigned roles",
    add: "Add user",
    searchPlaceholder: "Find by username, name or email",
    search: "Search",
    clear: "Clear",
    username: "Username",
    email: "Email",
    roles: "Roles",
    status: "Account status",
    actions: "Actions",
    active: "Active",
    locked: "Locked",
    superuser: "Superuser",
    noRole: "No roles assigned",
    roleSummary: (roles: number, pages: number) =>
      `${roles} role${roles === 1 ? "" : "s"} · ${pages} page permissions`,
    loading: "Loading system users...",
    empty: "No matching system users",
    selected: (count: number) =>
      `${count} user${count === 1 ? "" : "s"} selected`,
    deleteSelected: "Delete selected",
    createTitle: "Add system user",
    editTitle: "Edit system user",
    firstName: "First name",
    lastName: "Last name",
    passwordHint: "New users receive the default password password123.",
    roleTitle: "Assign roles",
    roleHint:
      "Multiple roles are supported. Effective page access is the union of all assigned role permissions.",
    noAvailableRoles:
      "No roles are available. Create one on Roles & Permissions first.",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    resetPassword: "Reset password",
    resetConfirm: (username: string) =>
      `Reset the password for “${username}”? It will be changed to password123.`,
    lock: "Lock account",
    unlock: "Unlock account",
    delete: "Delete",
    protectedUser: "Prevent deletion",
    protectedUserHint:
      "When enabled, both individual and bulk deletion are blocked by the backend.",
    deleteConfirm: (count: number) =>
      `Delete the ${count} selected system user${count === 1 ? "" : "s"}? This cannot be undone.`,
    deleteOneConfirm: (username: string) =>
      `Delete system user “${username}”? This cannot be undone.`,
    lockConfirm: (username: string) =>
      `Lock “${username}”? This user will no longer be able to sign in.`,
    saved: "User details saved",
    passwordReset: "Password reset",
    lockedNotice: "Account locked",
    unlockedNotice: "Account unlocked",
    deletedNotice: "User deleted",
    loadError: "Unable to load system users",
    saveError: "Unable to save the user. Check the details and try again.",
    operationError: "The operation failed. Please try again.",
    protectedHint: "This account is protected from deletion",
  },
} as const;

export function UserManagementPage() {
  const { locale } = useAppPreferences();
  const { showSuccess } = useToast();
  const text = copy[locale];
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<SystemUser | null | undefined>(
    undefined,
  );
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userPagination = useDataPagination(users);

  const activeRoles = useMemo(
    () =>
      roles.filter((role) => role.deleted_at === null && role.is_assignable),
    [roles],
  );
  const roleById = useMemo(
    () => new Map(roles.map((role) => [role.id, role])),
    [roles],
  );
  const deletableUsers = useMemo(
    () =>
      userPagination.pageItems.filter(
        (user) => !user.is_superuser && !user.is_protected,
      ),
    [userPagination.pageItems],
  );
  const allSelected =
    deletableUsers.length > 0 &&
    deletableUsers.every((user) => selectedIds.includes(user.id));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextUsers, nextRoles] = await Promise.all([
        getSystemUsers(appliedQuery),
        getAccessRoles(),
      ]);
      setUsers(nextUsers);
      setRoles(nextRoles);
      setSelectedIds((current) =>
        current.filter((id) =>
          nextUsers.some((user) => user.id === id && !user.is_superuser),
        ),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, text.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function openCreate() {
    setForm(emptyForm);
    setEditingUser(null);
  }

  function openEdit(user: SystemUser) {
    setForm({
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_active: user.is_active,
      is_protected: user.is_protected,
      role_ids: user.role_ids.filter((roleId) => roleById.get(roleId)?.is_assignable),
    });
    setEditingUser(user);
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const input: SystemUserInput = {
      username: form.username.trim(),
      email: form.email.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      is_active: form.is_active,
      is_protected: form.is_protected,
      role_ids: form.role_ids,
    };
    try {
      if (editingUser) await updateSystemUser(editingUser.id, input);
      else await createSystemUser(input);
      setEditingUser(undefined);
      showSuccess(text.saved);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(user: SystemUser) {
    if (!window.confirm(text.resetConfirm(user.username))) return;
    setSaving(true);
    setError(null);
    try {
      await resetSystemUserPassword(user.id);
      showSuccess(text.passwordReset);
    } catch (resetError) {
      setError(
        resetError instanceof Error ? resetError.message : text.operationError,
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleLocked(user: SystemUser) {
    if (user.is_superuser) return;
    if (user.is_active && !window.confirm(text.lockConfirm(user.username)))
      return;
    setSaving(true);
    setError(null);
    try {
      await setSystemUserLocked(user.id, user.is_active);
      showSuccess(user.is_active ? text.lockedNotice : text.unlockedNotice);
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : text.operationError,
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeUsers(userIds: string[], confirmation: string) {
    if (!window.confirm(confirmation)) return;
    setSaving(true);
    setError(null);
    try {
      if (userIds.length === 1) await deleteSystemUser(userIds[0]);
      else await bulkDeleteSystemUsers(userIds);
      setSelectedIds([]);
      showSuccess(text.deletedNotice);
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : text.operationError,
      );
    } finally {
      setSaving(false);
    }
  }

  function toggleRole(roleId: string) {
    setForm((current) => ({
      ...current,
      role_ids: current.role_ids.includes(roleId)
        ? current.role_ids.filter((id) => id !== roleId)
        : [...current.role_ids, roleId],
    }));
  }

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <PageBreadcrumb
              fallback={{ zh: "用户管理", en: "User Management" }}
            />
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              {text.description}
            </p>
          </div>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="size-4" />
            {text.add}
          </Button>
        </header>

        <Card className="overflow-hidden">
          {error ? (
            <button
              type="button"
              className="w-full border-b border-rose-500/20 bg-[var(--danger-soft)] px-4 py-3 text-left text-sm text-rose-600"
              onClick={() => setError(null)}
            >
              {error}
            </button>
          ) : null}

          <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <form
              className="flex w-full max-w-xl gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                userPagination.resetPage();
                setAppliedQuery(query.trim());
              }}
            >
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={`${inputClass} pl-9`}
                  placeholder={text.searchPlaceholder}
                  aria-label={text.searchPlaceholder}
                />
              </label>
              <Button type="submit" variant="outline">
                {text.search}
              </Button>
              {appliedQuery ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setQuery("");
                    userPagination.resetPage();
                    setAppliedQuery("");
                  }}
                >
                  {text.clear}
                </Button>
              ) : null}
            </form>
            {selectedIds.length ? (
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm text-[var(--muted)]">
                  {text.selected(selectedIds.length)}
                </span>
                <Button
                  variant="outline"
                  className="text-rose-600"
                  disabled={saving}
                  onClick={() =>
                    void removeUsers(
                      selectedIds,
                      text.deleteConfirm(selectedIds.length),
                    )
                  }
                >
                  <Trash2 className="size-4" />
                  {text.deleteSelected}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={text.selected(deletableUsers.length)}
                      checked={allSelected}
                      onChange={() =>
                        setSelectedIds((current) => {
                          const pageIds = deletableUsers.map((user) => user.id);
                          return allSelected
                            ? current.filter((id) => !pageIds.includes(id))
                            : [...new Set([...current, ...pageIds])];
                        })
                      }
                    />
                  </th>
                  <th className="px-4 py-3">{text.username}</th>
                  <th className="px-4 py-3">{text.email}</th>
                  <th className="px-4 py-3">{text.roles}</th>
                  <th className="w-32 px-4 py-3">{text.status}</th>
                  <th className="w-48 px-4 py-3 text-right">{text.actions}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-16 text-center text-[var(--muted)]"
                    >
                      {text.loading}
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-16 text-center text-[var(--muted)]"
                    >
                      {text.empty}
                    </td>
                  </tr>
                ) : (
                  userPagination.pageItems.map((user) => {
                    const userRoles = user.role_ids
                      .map((id) => roleById.get(id))
                      .filter((role): role is AccessRole => Boolean(role));
                    return (
                      <tr
                        key={user.id}
                        className="border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-muted)]"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            disabled={user.is_superuser || user.is_protected}
                            aria-label={`${text.selected(1)}: ${user.username}`}
                            checked={selectedIds.includes(user.id)}
                            onChange={() =>
                              setSelectedIds((current) =>
                                current.includes(user.id)
                                  ? current.filter((id) => id !== user.id)
                                  : [...current, user.id],
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] font-semibold text-[var(--primary)]">
                              {user.username.slice(0, 1).toUpperCase()}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5 font-medium">
                                {user.is_protected || user.is_superuser ? (
                                  <LockKeyhole className="size-3.5 text-[var(--muted)]" />
                                ) : null}
                                {user.username}
                              </div>
                              {user.first_name || user.last_name ? (
                                <div className="text-xs text-[var(--muted)]">
                                  {(locale === "zh-CN"
                                    ? [user.last_name, user.first_name]
                                    : [user.first_name, user.last_name])
                                    .filter(Boolean)
                                    .join(locale === "zh-CN" ? "" : " ")}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {user.email}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {user.is_superuser ? (
                              <RoleChip label={text.superuser} protectedRole />
                            ) : userRoles.length ? (
                              userRoles.map((role) => (
                                <RoleChip key={role.id} label={role.name} />
                              ))
                            ) : (
                              <span className="text-[var(--muted)]">
                                {text.noRole}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            {text.roleSummary(
                              user.role_ids.length,
                              user.effective_page_ids.length,
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                              user.is_active
                                ? "bg-[var(--success-soft)] text-emerald-600"
                                : "bg-[var(--danger-soft)] text-rose-600",
                            )}
                          >
                            {user.is_active ? (
                              <Check className="size-3.5" />
                            ) : (
                              <LockKeyhole className="size-3.5" />
                            )}
                            {user.is_active ? text.active : text.locked}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              aria-label={`${text.edit}: ${user.username}`}
                              onClick={() => openEdit(user)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              disabled={saving}
                              aria-label={`${text.resetPassword}: ${user.username}`}
                              onClick={() => void resetPassword(user)}
                            >
                              <KeyRound className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              disabled={saving || user.is_superuser}
                              title={
                                user.is_superuser
                                  ? text.protectedHint
                                  : user.is_active
                                    ? text.lock
                                    : text.unlock
                              }
                              aria-label={`${user.is_active ? text.lock : text.unlock}: ${user.username}`}
                              onClick={() => void toggleLocked(user)}
                            >
                              {user.is_active ? (
                                <LockKeyhole className="size-4" />
                              ) : (
                                <UnlockKeyhole className="size-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "size-9",
                                user.is_superuser || user.is_protected
                                  ? "text-[var(--muted)]"
                                  : "text-rose-500 hover:text-rose-600",
                              )}
                              disabled={
                                saving || user.is_superuser || user.is_protected
                              }
                              title={
                                user.is_superuser || user.is_protected
                                  ? text.protectedHint
                                  : text.delete
                              }
                              aria-label={`${text.delete}: ${user.username}`}
                              onClick={() =>
                                void removeUsers(
                                  [user.id],
                                  text.deleteOneConfirm(user.username),
                                )
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <DataPagination
            locale={locale}
            page={userPagination.page}
            pageSize={userPagination.pageSize}
            pageCount={userPagination.pageCount}
            totalItems={users.length}
            onPageChange={userPagination.setPage}
            onPageSizeChange={userPagination.setPageSize}
          />
        </Card>
      </main>

      {editingUser !== undefined ? (
        <Modal
          title={editingUser ? text.editTitle : text.createTitle}
          closeLabel={text.cancel}
          onClose={() => setEditingUser(undefined)}
        >
          <form className="space-y-5 p-5" onSubmit={saveUser}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={text.username}>
                <input
                  required
                  autoComplete="username"
                  value={form.username}
                  className={inputClass}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={text.email}>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  className={inputClass}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={text.firstName}>
                <input
                  value={form.first_name}
                  className={inputClass}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      first_name: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={text.lastName}>
                <input
                  value={form.last_name}
                  className={inputClass}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      last_name: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            {!editingUser ? (
              <p className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--muted)]">
                {text.passwordHint}
              </p>
            ) : null}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
              <input
                className="mt-0.5"
                type="checkbox"
                checked={form.is_protected}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    is_protected: event.target.checked,
                  }))
                }
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <LockKeyhole className="size-4" />
                  {text.protectedUser}
                </span>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  {text.protectedUserHint}
                </span>
              </span>
            </label>
            <section>
              <h3 className="font-semibold">{text.roleTitle}</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {text.roleHint}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {activeRoles.length ? (
                  activeRoles.map((role) => (
                    <label
                      key={role.id}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-xl border border-[var(--border)] p-3 transition-colors",
                        form.role_ids.includes(role.id) &&
                          "border-[var(--primary-border)] bg-[var(--primary-soft)]",
                      )}
                    >
                      <input
                        className="mt-0.5"
                        type="checkbox"
                        checked={form.role_ids.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {role.name}
                        </span>
                        <span className="block text-xs text-[var(--muted)]">
                          {role.description || role.code} ·{" "}
                          {role.page_ids.length}
                        </span>
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="col-span-full rounded-xl bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)]">
                    {text.noAvailableRoles}
                  </p>
                )}
              </div>
            </section>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingUser(undefined)}
              >
                {text.cancel}
              </Button>
              <Button type="submit" variant="outline" disabled={saving}>
                <ShieldCheck className="size-4" />
                {text.save}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </DashboardShell>
  );
}

const inputClass =
  "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)]";

function RoleChip({
  label,
  protectedRole = false,
}: {
  label: string;
  protectedRole?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        protectedRole
          ? "bg-[var(--tone-violet-bg)] text-[var(--tone-violet-fg)]"
          : "bg-[var(--primary-soft)] text-[var(--primary)]",
      )}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  closeLabel,
  narrow = false,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  narrow?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl",
          narrow ? "max-w-lg" : "max-w-3xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
              <UserRound className="size-4" />
            </span>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
