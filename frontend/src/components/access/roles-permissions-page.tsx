"use client";

import {
  Eye,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
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
  createAccessRole,
  deleteAccessRole,
  getAccessRoles,
  getNavigationItems,
  getNavigationMenus,
  restoreAccessRole,
  updateAccessRole,
  type AccessRole,
  type AccessRoleInput,
  type NavigationItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type RoleForm = AccessRoleInput;
type AnonymousAccessMode = NonNullable<AccessRoleInput["anonymous_access_mode"]>;

const ANONYMOUS_ROLE_CODE = "anonymous-user";

const emptyRoleForm: RoleForm = {
  code: "",
  name: "",
  description: "",
  is_protected: false,
  anonymous_access_mode: "NONE",
  page_ids: [],
};

const copy = {
  "zh-CN": {
    title: "角色权限",
    parent: "系统设置",
    description: "管理系统角色及其可访问、可搜索的页面",
    newRole: "新增角色",
    roleName: "角色名称",
    code: "唯一编码",
    roleDescription: "描述",
    pages: "可见页面",
    status: "状态",
    actions: "操作",
    active: "正常",
    deletedStatus: "已删除",
    noDescription: "未填写描述",
    noPages: "未配置页面",
    pageCount: (count: number) => `${count} 个页面`,
    loading: "正在读取角色权限...",
    empty: "还没有角色，请新增第一个角色",
    createTitle: "新增角色",
    editTitle: "编辑角色",
    permissionsTitle: "页面权限",
    permissionsHint:
      "分类由所选页面自动带出；分类下没有选中页面时，该分类不会显示。",
    save: "保存",
    cancel: "取消",
    delete: "删除",
    permanentDelete: "永久删除",
    restore: "还原",
    edit: "编辑",
    deleteConfirm: (name: string) =>
      `确定删除角色“${name}”吗？删除后仍可还原。`,
    permanentDeleteConfirm: (name: string) =>
      `确定永久删除角色“${name}”吗？角色及其页面权限将无法恢复。`,
    protectedRole: "不可删除",
    protectedHint: "用于最高权限等关键角色；启用后后端将禁止删除该角色。",
    protectedDeleteHint: "该角色已设置为不可删除",
    anonymousRoleBadge: "未登录策略",
    anonymousModeTitle: "未登录访问",
    anonymousLoginPage: "登录页",
    anonymousSystemPage: "系统页",
    anonymousLoginHint:
      "选择登录页时，未登录访客只能看到登录页；下方勾选页面会保留但不会生效。",
    anonymousSystemHint:
      "选择系统页时，未登录访客访问根地址会看到下方勾选的页面入口。",
    notAssignable: "不可分配给用户",
    saved: "角色权限已保存",
    deleted: "角色已删除，可以随时还原",
    permanentlyDeleted: "角色已永久删除",
    restored: "角色已还原",
    loadError: "角色权限加载失败",
    saveError: "角色保存失败，请检查内容后重试",
    deleteError: "角色删除失败",
  },
  "en-GB": {
    title: "Roles & Permissions",
    parent: "Settings",
    description: "Manage system roles and the pages they can access and search",
    newRole: "New role",
    roleName: "Role name",
    code: "Unique code",
    roleDescription: "Description",
    pages: "Visible pages",
    status: "Status",
    actions: "Actions",
    active: "Active",
    deletedStatus: "Deleted",
    noDescription: "No description",
    noPages: "No pages assigned",
    pageCount: (count: number) => `${count} page${count === 1 ? "" : "s"}`,
    loading: "Loading roles and permissions...",
    empty: "No roles yet. Create the first role.",
    createTitle: "Create role",
    editTitle: "Edit role",
    permissionsTitle: "Page permissions",
    permissionsHint:
      "Categories are derived from selected pages and disappear when none of their pages are selected.",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    permanentDelete: "Delete permanently",
    restore: "Restore",
    edit: "Edit",
    deleteConfirm: (name: string) =>
      `Delete the role “${name}”? It can still be restored.`,
    permanentDeleteConfirm: (name: string) =>
      `Permanently delete “${name}”? The role and its page permissions cannot be recovered.`,
    protectedRole: "Cannot be deleted",
    protectedHint:
      "Use for critical roles such as the highest-privilege role. The backend will prevent deletion.",
    protectedDeleteHint: "This role is protected from deletion",
    anonymousRoleBadge: "Anonymous policy",
    anonymousModeTitle: "Anonymous access",
    anonymousLoginPage: "Login page",
    anonymousSystemPage: "System page",
    anonymousLoginHint:
      "When Login page is selected, visitors only see the sign-in page. Selected pages are saved but ignored.",
    anonymousSystemHint:
      "When System page is selected, visitors opening the root URL see the selected page entries.",
    notAssignable: "Not assignable to users",
    saved: "Role permissions saved",
    deleted: "Role deleted and available for restoration",
    permanentlyDeleted: "Role permanently deleted",
    restored: "Role restored",
    loadError: "Unable to load roles and permissions",
    saveError: "Unable to save the role. Check the details and try again.",
    deleteError: "Unable to delete the role",
  },
} as const;

export function RolesPermissionsPage() {
  const { locale } = useAppPreferences();
  const { showSuccess } = useToast();
  const text = copy[locale];
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<AccessRole | null | undefined>(
    undefined,
  );
  const [form, setForm] = useState<RoleForm>(emptyRoleForm);
  const rolePagination = useDataPagination(roles);

  const pageGroups = useMemo(
    () => buildPageGroups(navigationItems, locale),
    [navigationItems, locale],
  );
  const assignablePageIds = useMemo(
    () =>
      new Set(
        navigationItems
          .filter((item) => item.item_type === "PAGE" && item.is_active)
          .map((item) => item.id),
      ),
    [navigationItems],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextRoles, menus] = await Promise.all([
        getAccessRoles(),
        getNavigationMenus(),
      ]);
      const mainMenu =
        menus.find((menu) => menu.code === "main-sidebar") ?? menus[0];
      const items = mainMenu ? await getNavigationItems(mainMenu.id) : [];
      setRoles(nextRoles);
      setNavigationItems(items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [text.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function openCreate() {
    setForm(emptyRoleForm);
    setEditingRole(null);
  }

  function openEdit(role: AccessRole) {
    setForm({
      code: role.code,
      name: role.name,
      description: role.description,
      is_protected: role.is_protected,
      anonymous_access_mode: role.anonymous_access_mode,
      page_ids: role.page_ids.filter((pageId) => assignablePageIds.has(pageId)),
    });
    setEditingRole(role);
  }

  function togglePage(pageId: string) {
    setForm((current) => ({
      ...current,
      page_ids: current.page_ids.includes(pageId)
        ? current.page_ids.filter((id) => id !== pageId)
        : [...current.page_ids, pageId],
    }));
  }

  function toggleGroup(pageIds: string[]) {
    setForm((current) => {
      const allSelected = pageIds.every((pageId) =>
        current.page_ids.includes(pageId),
      );
      return {
        ...current,
        page_ids: allSelected
          ? current.page_ids.filter((pageId) => !pageIds.includes(pageId))
          : [...new Set([...current.page_ids, ...pageIds])],
      };
    });
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const input: AccessRoleInput = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      is_protected: form.is_protected,
      anonymous_access_mode:
        form.code.trim() === ANONYMOUS_ROLE_CODE
          ? form.anonymous_access_mode
          : "NONE",
      page_ids: form.page_ids.filter((pageId) => assignablePageIds.has(pageId)),
    };
    try {
      if (editingRole) await updateAccessRole(editingRole.id, input);
      else await createAccessRole(input);
      setEditingRole(undefined);
      showSuccess(text.saved);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function removeRole(role: AccessRole) {
    if (role.is_protected) return;
    const permanently = role.deleted_at !== null;
    if (
      !window.confirm(
        permanently
          ? text.permanentDeleteConfirm(role.name)
          : text.deleteConfirm(role.name),
      )
    )
      return;
    setSaving(true);
    setError(null);
    try {
      await deleteAccessRole(role.id);
      if (permanently)
        setRoles((current) => current.filter((item) => item.id !== role.id));
      else await load();
      showSuccess(permanently ? text.permanentlyDeleted : text.deleted);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : text.deleteError,
      );
    } finally {
      setSaving(false);
    }
  }

  async function restoreRole(role: AccessRole) {
    setSaving(true);
    setError(null);
    try {
      await restoreAccessRole(role.id);
      await load();
      showSuccess(text.restored);
    } catch (restoreError) {
      setError(
        restoreError instanceof Error ? restoreError.message : text.saveError,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <PageBreadcrumb
              fallback={{ zh: "角色权限", en: "Roles & Permissions" }}
            />
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              {text.description}
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" /> {text.newRole}
          </Button>
        </header>

        <Card className="overflow-hidden">
          {error ? (
            <div className="border-b border-rose-500/20 bg-[var(--danger-soft)] px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">{text.roleName}</th>
                  <th className="w-44 px-4 py-3">{text.code}</th>
                  <th className="px-4 py-3">{text.roleDescription}</th>
                  <th className="w-40 px-4 py-3">{text.pages}</th>
                  <th className="w-28 px-4 py-3">{text.status}</th>
                  <th className="w-40 px-4 py-3 text-right">{text.actions}</th>
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
                ) : roles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-16 text-center text-[var(--muted)]"
                    >
                      {text.empty}
                    </td>
                  </tr>
                ) : (
                  rolePagination.pageItems.map((role) => (
                    <tr
                      key={role.id}
                      className={cn(
                        "border-t border-[var(--border)] hover:bg-[var(--surface-muted)]",
                        role.deleted_at && "opacity-65",
                      )}
                    >
                      <td className="px-4 py-3 font-medium">
                        <div className="flex flex-col gap-1.5">
                          <span className="inline-flex items-center gap-2">
                            {role.is_protected ? (
                              <Lock className="size-3.5 text-[var(--muted)]" />
                            ) : null}
                            {role.name}
                          </span>
                          {role.code === ANONYMOUS_ROLE_CODE ? (
                            <span className="inline-flex w-fit items-center rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                              {text.anonymousRoleBadge}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-xs">
                          {role.code}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        <div className="space-y-1">
                          <p>{role.description || text.noDescription}</p>
                          {!role.is_assignable ? (
                            <p className="text-xs">{text.notAssignable}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-medium text-[var(--primary)]">
                          <Eye className="size-3.5" />
                          {role.page_ids.length
                            ? text.pageCount(role.page_ids.length)
                            : text.noPages}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                            role.deleted_at
                              ? "bg-[var(--danger-soft)] text-rose-600"
                              : "bg-[var(--success-soft)] text-emerald-600",
                          )}
                        >
                          {role.deleted_at ? text.deletedStatus : text.active}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {role.deleted_at ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              disabled={saving}
                              aria-label={`${text.restore}: ${role.name}`}
                              onClick={() => void restoreRole(role)}
                            >
                              <RotateCcw className="size-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              aria-label={`${text.edit}: ${role.name}`}
                              onClick={() => openEdit(role)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title={
                              role.is_protected
                                ? text.protectedDeleteHint
                                : undefined
                            }
                            className={cn(
                              "size-9",
                              role.is_protected
                                ? "text-[var(--muted)]"
                                : "text-rose-500 hover:text-rose-600",
                            )}
                            disabled={saving || role.is_protected}
                            aria-label={`${role.deleted_at ? text.permanentDelete : text.delete}: ${role.name}`}
                            onClick={() => void removeRole(role)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DataPagination
            locale={locale}
            page={rolePagination.page}
            pageSize={rolePagination.pageSize}
            pageCount={rolePagination.pageCount}
            totalItems={roles.length}
            onPageChange={rolePagination.setPage}
            onPageSizeChange={rolePagination.setPageSize}
          />
        </Card>
      </main>

      {editingRole !== undefined ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={editingRole ? text.editTitle : text.createTitle}
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <h2 className="text-lg font-semibold">
                {editingRole ? text.editTitle : text.createTitle}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label={text.cancel}
                onClick={() => setEditingRole(undefined)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <form className="space-y-5 p-5" onSubmit={saveRole}>
              {(() => {
                const isAnonymousRole =
                  editingRole?.code === ANONYMOUS_ROLE_CODE ||
                  form.code === ANONYMOUS_ROLE_CODE;
                const anonymousMode =
                  form.anonymous_access_mode ?? "LOGIN_PAGE";
                return (
                  <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={text.roleName}>
                  <input
                    required
                    value={form.name}
                    className={inputClass}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label={text.code}>
                  <input
                    required
                    disabled={isAnonymousRole}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    value={form.code}
                    className={cn(inputClass, isAnonymousRole && "opacity-65")}
                    placeholder="store-manager"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
              {isAnonymousRole ? (
                <section className="rounded-xl border border-[var(--border)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">
                        {text.anonymousModeTitle}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {anonymousMode === "SYSTEM_PAGE"
                          ? text.anonymousSystemHint
                          : text.anonymousLoginHint}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--muted)]">
                      {text.notAssignable}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ["LOGIN_PAGE", text.anonymousLoginPage],
                        ["SYSTEM_PAGE", text.anonymousSystemPage],
                      ] as const
                    ).map(([mode, label]) => (
                      <label
                        key={mode}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3 text-sm transition-colors",
                          anonymousMode === mode &&
                            "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]",
                        )}
                      >
                        <input
                          type="radio"
                          name="anonymous-access-mode"
                          checked={anonymousMode === mode}
                          onChange={() =>
                            setForm((current) => ({
                              ...current,
                              anonymous_access_mode: mode as AnonymousAccessMode,
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </section>
              ) : null}
              <Field label={text.roleDescription}>
                <textarea
                  rows={3}
                  value={form.description}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </Field>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
                <input
                  className="mt-0.5"
                  type="checkbox"
                  checked={form.is_protected}
                  disabled={isAnonymousRole}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      is_protected: event.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Lock className="size-4" />
                    {text.protectedRole}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {text.protectedHint}
                  </span>
                </span>
              </label>

              <section>
                <div className="mb-3">
                  <h3 className="font-semibold">{text.permissionsTitle}</h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {isAnonymousRole && anonymousMode === "LOGIN_PAGE"
                      ? text.anonymousLoginHint
                      : text.permissionsHint}
                  </p>
                </div>
                <div className="space-y-3">
                  {pageGroups.map((group) => {
                    const groupPageIds = group.pages.map((page) => page.id);
                    const allSelected = groupPageIds.every((pageId) =>
                      form.page_ids.includes(pageId),
                    );
                    return (
                      <div
                        key={group.key}
                        className="rounded-xl border border-[var(--border)]"
                      >
                        <label className="flex cursor-pointer items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 font-medium">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => toggleGroup(groupPageIds)}
                          />
                          {group.label}
                          <span className="ml-auto text-xs font-normal text-[var(--muted)]">
                            {
                              group.pages.filter((page) =>
                                form.page_ids.includes(page.id),
                              ).length
                            }
                            /{group.pages.length}
                          </span>
                        </label>
                        <div className="grid gap-1 p-2 sm:grid-cols-2">
                          {group.pages.map((page) => (
                            <label
                              key={page.id}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--surface-muted)]",
                                form.page_ids.includes(page.id) &&
                                  "bg-[var(--primary-soft)]",
                              )}
                            >
                              <input
                                className="mt-0.5"
                                type="checkbox"
                                checked={form.page_ids.includes(page.id)}
                                onChange={() => togglePage(page.id)}
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium">
                                  {locale === "en-GB"
                                    ? page.label_en
                                    : page.label_zh}
                                </span>
                                <code className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
                                  {page.frontend_path}
                                </code>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
                  </>
                );
              })()}

              <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingRole(undefined)}
                >
                  {text.cancel}
                </Button>
                <Button type="submit" disabled={saving}>
                  <ShieldCheck className="size-4" />
                  {text.save}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}

const inputClass =
  "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)]";

function buildPageGroups(items: NavigationItem[], locale: "zh-CN" | "en-GB") {
  const categories = items
    .filter((item) => item.item_type === "CATEGORY")
    .sort((left, right) => left.position - right.position);
  const pages = items.filter((item) => item.item_type === "PAGE");
  const categoryGroups = categories
    .map((category) => ({
      key: category.id,
      label: locale === "en-GB" ? category.label_en : category.label_zh,
      pages: pages
        .filter((page) => page.parent_id === category.id)
        .sort((left, right) => left.position - right.position),
    }))
    .filter((group) => group.pages.length > 0);
  const topLevelPages = pages
    .filter((page) => page.parent_id === null)
    .sort((left, right) => left.position - right.position);
  return topLevelPages.length > 0
    ? [
        {
          key: "__top__",
          label: locale === "en-GB" ? "Top-level pages" : "顶层页面",
          pages: topLevelPages,
        },
        ...categoryGroups,
      ]
    : categoryGroups;
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
