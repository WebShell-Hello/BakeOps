"use client";

import {
  AlertCircle,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FolderTree,
  GripVertical,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import {
  type DragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageBreadcrumb } from "@/components/navigation/page-breadcrumb";
import { NavigationIcon } from "@/components/navigation/navigation-icon";
import { useAppPreferences } from "@/components/providers/app-preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { notifyNavigationChanged } from "@/hooks/use-navigation-tree";
import {
  createNavigationItem,
  getNavigationItems,
  getNavigationMenus,
  reorderNavigationItems,
  updateNavigationItem,
  type NavigationItem,
  type NavigationItemInput,
  type NavigationItemType,
  type NavigationMenu,
  type NavigationReorderItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const iconOptions = [
  "LayoutDashboard",
  "BarChart3",
  "CalendarRange",
  "BriefcaseBusiness",
  "FileText",
  "FolderTree",
  "Package",
  "UsersRound",
  "Settings",
] as const;

type ItemFormState = {
  item_type: NavigationItemType;
  key: string;
  label_zh: string;
  label_en: string;
  icon_key: string;
  frontend_path: string;
  parent_id: string;
  is_visible: boolean;
};

const emptyItemForm: ItemFormState = {
  item_type: "CATEGORY",
  key: "",
  label_zh: "",
  label_en: "",
  icon_key: "FolderTree",
  frontend_path: "",
  parent_id: "",
  is_visible: true,
};

const copy = {
  "zh-CN": {
    title: "菜单管理",
    description: "管理侧边栏分类、页签、页面路径、显示状态与排序",
    sidebar: "侧边栏",
    newCategory: "新增分类",
    newPage: "新增页签",
    order: "排序",
    name: "名称",
    categoryColumn: "分类",
    type: "类型",
    path: "前端路径",
    visible: "可见",
    actions: "操作",
    category: "分类",
    page: "页签",
    noPath: "—",
    edit: "编辑",
    hide: "隐藏",
    show: "显示",
    loading: "正在读取真实数据库菜单...",
    empty: "当前侧边栏还没有菜单项目",
    loadError: "菜单数据加载失败",
    dragHint: "拖动第一列可调整同级项目顺序",
    save: "保存",
    cancel: "取消",
    editItem: "编辑菜单项目",
    createItem: "新建菜单项目",
    chineseName: "中文名称",
    englishName: "英文名称",
    key: "唯一编码",
    icon: "图标",
    parent: "所属分类",
    topLevel: "顶层页签",
    topLevelShort: "顶层",
    internalPath: "Next.js 前端路径",
    itemType: "项目类型",
    saveSuccess: "菜单项目已保存",
    visibilitySuccess: "显示状态已更新",
    reorderSuccess: "菜单排序已保存",
    conflict: "菜单已被其他操作修改，数据已重新加载",
    formError: "请检查表单内容后重试",
  },
  "en-GB": {
    title: "Menu Management",
    description:
      "Manage sidebar categories, pages, routes, visibility and ordering",
    sidebar: "Sidebar",
    newCategory: "New category",
    newPage: "New page",
    order: "Order",
    name: "Name",
    categoryColumn: "Category",
    type: "Type",
    path: "Frontend path",
    visible: "Visible",
    actions: "Actions",
    category: "Category",
    page: "Page",
    noPath: "—",
    edit: "Edit",
    hide: "Hide",
    show: "Show",
    loading: "Loading navigation from the database...",
    empty: "This sidebar has no menu items",
    loadError: "Unable to load navigation",
    dragHint: "Drag the first column to reorder sibling items",
    save: "Save",
    cancel: "Cancel",
    editItem: "Edit menu item",
    createItem: "Create menu item",
    chineseName: "Chinese name",
    englishName: "English name",
    key: "Unique key",
    icon: "Icon",
    parent: "Parent category",
    topLevel: "Top-level page",
    topLevelShort: "Top level",
    internalPath: "Next.js frontend path",
    itemType: "Item type",
    saveSuccess: "Menu item saved",
    visibilitySuccess: "Visibility updated",
    reorderSuccess: "Menu order saved",
    conflict: "The menu changed elsewhere and has been reloaded",
    formError: "Check the form and try again",
  },
} as const;

export function MenuManagementPage() {
  const { locale } = useAppPreferences();
  const { showSuccess } = useToast();
  const text = copy[locale];
  const [menus, setMenus] = useState<NavigationMenu[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [items, setItems] = useState<NavigationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const dragStartItemsRef = useRef<NavigationItem[] | null>(null);
  const dragDroppedRef = useRef(false);
  const rowElementsRef = useRef(new Map<string, HTMLTableRowElement>());
  const previousRowTopsRef = useRef(new Map<string, number>());
  const rowAnimationsRef = useRef(new Map<string, Animation[]>());
  const shouldAnimateRowsRef = useRef(false);
  const lastReorderRef = useRef<{
    occurredAt: number;
    pointerY: number;
  } | null>(null);
  const [editingItem, setEditingItem] = useState<
    NavigationItem | null | undefined
  >(undefined);
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm);

  const selectedMenu = menus.find((menu) => menu.id === selectedMenuId) ?? null;
  const categories = useMemo(
    () =>
      items
        .filter((item) => item.item_type === "CATEGORY")
        .sort(comparePosition),
    [items],
  );
  const rows = useMemo(() => flattenNavigationItems(items), [items]);
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const load = useCallback(
    async (preferredMenuId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const nextMenus = await getNavigationMenus();
        const nextMenuId =
          preferredMenuId &&
          nextMenus.some((menu) => menu.id === preferredMenuId)
            ? preferredMenuId
            : (nextMenus.find((menu) => menu.code === "main-sidebar")?.id ??
              nextMenus[0]?.id ??
              "");
        const nextItems = nextMenuId
          ? await getNavigationItems(nextMenuId)
          : [];
        setMenus(nextMenus);
        setSelectedMenuId(nextMenuId);
        setItems(nextItems);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : text.loadError,
        );
      } finally {
        setLoading(false);
      }
    },
    [text.loadError],
  );

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  useLayoutEffect(() => {
    if (!shouldAnimateRowsRef.current) return;
    shouldAnimateRowsRef.current = false;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    for (const [itemId, row] of rowElementsRef.current) {
      const previousTop = previousRowTopsRef.current.get(itemId);
      if (previousTop === undefined || itemId === draggedItemId) continue;

      const verticalOffset = previousTop - row.getBoundingClientRect().top;
      if (Math.abs(verticalOffset) < 1) continue;

      rowAnimationsRef.current
        .get(itemId)
        ?.forEach((animation) => animation.cancel());
      if (reduceMotion) continue;

      const animations = Array.from(row.cells).map((cell) =>
        cell.animate(
          [
            { transform: `translate3d(0, ${verticalOffset}px, 0)` },
            { transform: "translate3d(0, 0, 0)" },
          ],
          {
            duration: 210,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        ),
      );
      rowAnimationsRef.current.set(itemId, animations);
    }
    previousRowTopsRef.current.clear();
  }, [draggedItemId, rows]);

  function openCreateItem(itemType: NavigationItemType) {
    setItemForm({
      ...emptyItemForm,
      item_type: itemType,
      icon_key: itemType === "CATEGORY" ? "FolderTree" : "FileText",
      parent_id: itemType === "PAGE" ? (categories[0]?.id ?? "") : "",
    });
    setEditingItem(null);
  }

  function openEditItem(item: NavigationItem) {
    setItemForm({
      item_type: item.item_type,
      key: item.key,
      label_zh: item.label_zh,
      label_en: item.label_en,
      icon_key: item.icon_key,
      frontend_path: item.frontend_path ?? "",
      parent_id: item.parent_id ?? "",
      is_visible: item.is_visible,
    });
    setEditingItem(item);
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMenuId) return;
    setSaving(true);
    setError(null);
    const input: NavigationItemInput = {
      item_type: itemForm.item_type,
      key: itemForm.key.trim(),
      label_zh: itemForm.label_zh.trim(),
      label_en: itemForm.label_en.trim(),
      icon_key: itemForm.icon_key,
      frontend_path:
        itemForm.item_type === "PAGE" ? itemForm.frontend_path.trim() : null,
      parent_id:
        itemForm.item_type === "PAGE" && itemForm.parent_id
          ? itemForm.parent_id
          : null,
      is_visible: itemForm.is_visible,
    };
    try {
      if (editingItem) await updateNavigationItem(editingItem.id, input);
      else await createNavigationItem(selectedMenuId, input);
      setEditingItem(undefined);
      showSuccess(text.saveSuccess);
      await load(selectedMenuId);
      notifyNavigationChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.formError);
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility(item: NavigationItem) {
    setSaving(true);
    setError(null);
    try {
      await updateNavigationItem(item.id, { is_visible: !item.is_visible });
      showSuccess(text.visibilitySuccess);
      await load(selectedMenuId);
      notifyNavigationChanged();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : text.formError,
      );
    } finally {
      setSaving(false);
    }
  }

  function startDrag(
    item: NavigationItem,
    event: DragEvent<HTMLButtonElement>,
  ) {
    dragStartItemsRef.current = items;
    dragDroppedRef.current = false;
    lastReorderRef.current = null;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
    const row = event.currentTarget.closest("tr");
    if (row)
      event.dataTransfer.setDragImage(
        row,
        28,
        row.getBoundingClientRect().height / 2,
      );
    setDraggedItemId(item.id);
  }

  function captureRowPositions() {
    previousRowTopsRef.current.clear();
    for (const [itemId, row] of rowElementsRef.current) {
      previousRowTopsRef.current.set(itemId, row.getBoundingClientRect().top);
    }
    shouldAnimateRowsRef.current = true;
  }

  function previewReorder(
    targetItem: NavigationItem,
    event: DragEvent<HTMLTableRowElement>,
  ) {
    if (!draggedItemId || draggedItemId === targetItem.id) return;

    const draggedItem = items.find((item) => item.id === draggedItemId);
    if (!draggedItem || draggedItem.parent_id !== targetItem.parent_id) return;

    const siblingGroups = groupItemsByParent(items);
    const groupKey = parentKey(targetItem.parent_id);
    const siblings = siblingGroups.get(groupKey) ?? [];
    const sourceIndex = siblings.findIndex(
      (item) => item.id === draggedItem.id,
    );
    const targetIndex = siblings.findIndex((item) => item.id === targetItem.id);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex)
      return;

    const targetBounds = event.currentTarget.getBoundingClientRect();
    const pointerY = event.clientY;
    const movingDown = sourceIndex < targetIndex;
    const crossedIntentThreshold = movingDown
      ? pointerY >= targetBounds.top + targetBounds.height * 0.7
      : pointerY <= targetBounds.top + targetBounds.height * 0.3;
    if (!crossedIntentThreshold) return;

    const now = event.timeStamp;
    const previousReorder = lastReorderRef.current;
    if (
      previousReorder &&
      (now - previousReorder.occurredAt < 140 ||
        Math.abs(pointerY - previousReorder.pointerY) < 10)
    ) {
      return;
    }

    captureRowPositions();
    const reorderedSiblings = [...siblings];
    reorderedSiblings.splice(sourceIndex, 1);
    reorderedSiblings.splice(targetIndex, 0, draggedItem);
    siblingGroups.set(groupKey, reorderedSiblings);

    setItems(
      items.map((item) => {
        const siblingsForItem =
          siblingGroups.get(parentKey(item.parent_id)) ?? [];
        const nextPosition = siblingsForItem.findIndex(
          (sibling) => sibling.id === item.id,
        );
        return nextPosition === -1 ? item : { ...item, position: nextPosition };
      }),
    );
    lastReorderRef.current = { occurredAt: now, pointerY };
  }

  function cancelDrag() {
    if (!dragDroppedRef.current && dragStartItemsRef.current) {
      captureRowPositions();
      setItems(dragStartItemsRef.current);
    }
    dragStartItemsRef.current = null;
    dragDroppedRef.current = false;
    lastReorderRef.current = null;
    setDraggedItemId(null);
  }

  async function commitDrop(event: DragEvent<HTMLTableRowElement>) {
    event.preventDefault();
    if (!draggedItemId || !selectedMenu) return;
    dragDroppedRef.current = true;
    setDraggedItemId(null);
    const reorderedItems = items;
    const payload: NavigationReorderItem[] = reorderedItems.map((item) => ({
      id: item.id,
      parent_id: item.parent_id,
      position: item.position,
    }));
    try {
      const updatedMenu = await reorderNavigationItems(
        selectedMenu.id,
        selectedMenu.revision,
        payload,
      );
      setMenus((currentMenus) =>
        currentMenus.map((menu) =>
          menu.id === updatedMenu.id ? updatedMenu : menu,
        ),
      );
      showSuccess(text.reorderSuccess);
      notifyNavigationChanged();
    } catch (reorderError) {
      const status = (reorderError as Error & { status?: number }).status;
      setError(
        status === 409
          ? text.conflict
          : reorderError instanceof Error
            ? reorderError.message
            : text.formError,
      );
      await load(selectedMenu.id);
    } finally {
      dragStartItemsRef.current = null;
      dragDroppedRef.current = false;
      lastReorderRef.current = null;
    }
  }

  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 xl:p-9">
        <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <PageBreadcrumb
              fallback={{ zh: "菜单管理", en: "Menu Management" }}
            />
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              {text.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => openCreateItem("CATEGORY")}
              disabled={!selectedMenuId}
            >
              <FolderTree className="size-4" /> {text.newCategory}
            </Button>
            <Button
              onClick={() => openCreateItem("PAGE")}
              disabled={!selectedMenuId}
            >
              <Plus className="size-4" /> {text.newPage}
            </Button>
          </div>
        </header>

        <Card className="overflow-hidden">
          {error ? (
            <div className="flex items-center gap-2 border-b border-rose-500/20 bg-[var(--danger-soft)] px-4 py-3 text-sm text-rose-600">
              <AlertCircle className="size-4" /> {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="w-16 px-4 py-3">{text.order}</th>
                  <th className="px-4 py-3">{text.name}</th>
                  <th className="w-40 px-4 py-3">{text.categoryColumn}</th>
                  <th className="w-24 px-4 py-3">{text.type}</th>
                  <th className="px-4 py-3">{text.path}</th>
                  <th className="w-24 px-4 py-3">{text.visible}</th>
                  <th className="w-40 px-4 py-3 text-right">{text.actions}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-16 text-center text-[var(--muted)]"
                    >
                      {text.loading}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-16 text-center text-[var(--muted)]"
                    >
                      {text.empty}
                    </td>
                  </tr>
                ) : (
                  rows.map((item) => (
                    <tr
                      key={item.id}
                      ref={(row) => {
                        if (row) rowElementsRef.current.set(item.id, row);
                        else rowElementsRef.current.delete(item.id);
                      }}
                      data-navigation-row={item.key}
                      className={cn(
                        "border-t border-[var(--border)] transition-[background-color,opacity] duration-150 hover:bg-[var(--surface-muted)]",
                        item.item_type === "CATEGORY" &&
                          "bg-[var(--surface-muted)]/70 text-[var(--muted)]",
                        draggedItemId === item.id &&
                          "bg-[var(--primary-soft)] opacity-30",
                      )}
                      onDragOver={(event: DragEvent<HTMLTableRowElement>) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        previewReorder(item, event);
                      }}
                      onDrop={(event) => void commitDrop(event)}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          draggable
                          aria-label={`${text.order}: ${locale === "en-GB" ? item.label_en : item.label_zh}`}
                          className="cursor-grab rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--card)] active:cursor-grabbing"
                          onDragStart={(event) => startDrag(item, event)}
                          onDragEnd={cancelDrag}
                        >
                          <GripVertical className="size-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">
                            {locale === "en-GB" ? item.label_en : item.label_zh}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            {item.key}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {item.item_type === "CATEGORY"
                          ? text.category
                          : item.parent_id
                            ? locale === "en-GB"
                              ? categoriesById.get(item.parent_id)?.label_en
                              : categoriesById.get(item.parent_id)?.label_zh
                            : text.topLevelShort}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {item.item_type === "CATEGORY"
                          ? text.category
                          : text.page}
                      </td>
                      <td className="px-4 py-3 text-left">
                        <code className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-xs">
                          {item.frontend_path ?? text.noPath}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                            item.is_visible
                              ? "bg-[var(--success-soft)] text-emerald-600"
                              : "bg-[var(--surface-muted)] text-[var(--muted)]",
                          )}
                        >
                          {item.is_visible ? text.show : text.hide}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9"
                            aria-label={`${text.edit}: ${item.label_zh}`}
                            onClick={() => openEditItem(item)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9"
                            disabled={saving}
                            aria-label={`${item.is_visible ? text.hide : text.show}: ${item.label_zh}`}
                            onClick={() => void toggleVisibility(item)}
                          >
                            {item.is_visible ? (
                              <Eye className="size-4" />
                            ) : (
                              <EyeOff className="size-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      {editingItem !== undefined ? (
        <Modal
          title={editingItem ? text.editItem : text.createItem}
          closeLabel={text.cancel}
          onClose={() => setEditingItem(undefined)}
        >
          <form className="space-y-4" onSubmit={saveItem}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={text.itemType}>
                <select
                  value={itemForm.item_type}
                  disabled={Boolean(editingItem)}
                  className={inputClass}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      item_type: event.target.value as NavigationItemType,
                    }))
                  }
                >
                  <option value="CATEGORY">{text.category}</option>
                  <option value="PAGE">{text.page}</option>
                </select>
              </Field>
              <Field label={text.key}>
                <input
                  required
                  value={itemForm.key}
                  className={inputClass}
                  placeholder="settings.menu-management"
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      key: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={text.chineseName}>
                <input
                  required
                  value={itemForm.label_zh}
                  className={inputClass}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      label_zh: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={text.englishName}>
                <input
                  required
                  value={itemForm.label_en}
                  className={inputClass}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      label_en: event.target.value,
                    }))
                  }
                />
              </Field>
              <div className="space-y-1.5 text-sm font-medium">
                <span id="navigation-icon-label">{text.icon}</span>
                <IconPicker
                  labelledBy="navigation-icon-label"
                  value={itemForm.icon_key}
                  onChange={(iconKey) =>
                    setItemForm((current) => ({
                      ...current,
                      icon_key: iconKey,
                    }))
                  }
                />
              </div>
              {itemForm.item_type === "PAGE" ? (
                <Field label={text.parent}>
                  <select
                    value={itemForm.parent_id}
                    className={inputClass}
                    onChange={(event) =>
                      setItemForm((current) => ({
                        ...current,
                        parent_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">{text.topLevel}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {locale === "en-GB"
                          ? category.label_en
                          : category.label_zh}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </div>
            {itemForm.item_type === "PAGE" ? (
              <Field label={text.internalPath}>
                <input
                  required
                  value={itemForm.frontend_path}
                  className={inputClass}
                  placeholder="/settings/menu-management"
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      frontend_path: event.target.value,
                    }))
                  }
                />
              </Field>
            ) : null}
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={itemForm.is_visible}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    is_visible: event.target.checked,
                  }))
                }
              />
              {text.visible}
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingItem(undefined)}
              >
                {text.cancel}
              </Button>
              <Button type="submit" disabled={saving}>
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
  "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)] disabled:opacity-60";

function comparePosition(left: NavigationItem, right: NavigationItem) {
  return left.position - right.position;
}
function parentKey(parentId: string | null) {
  return parentId ?? "__root__";
}

function groupItemsByParent(items: NavigationItem[]) {
  const groups = new Map<string, NavigationItem[]>();
  for (const item of items) {
    const key = parentKey(item.parent_id);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  for (const [key, siblings] of groups)
    groups.set(key, siblings.sort(comparePosition));
  return groups;
}

function flattenNavigationItems(items: NavigationItem[]) {
  const groups = groupItemsByParent(items);
  const rows: NavigationItem[] = [];
  for (const item of groups.get("__root__") ?? []) {
    rows.push(item);
    if (item.item_type === "CATEGORY") {
      rows.push(
        ...(groups.get(item.id) ?? []).filter(
          (child) => child.item_type === "PAGE",
        ),
      );
    }
  }
  return rows;
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

function IconPicker({
  labelledBy,
  value,
  onChange,
}: {
  labelledBy: string;
  value: string;
  onChange: (iconKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const options = iconOptions.some((icon) => icon === value)
    ? iconOptions
    : [value, ...iconOptions];

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative font-normal">
      <button
        type="button"
        aria-labelledby={labelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(inputClass, "flex items-center gap-2 text-left")}
        onClick={() => setOpen((current) => !current)}
      >
        <NavigationIcon
          iconKey={value}
          className="size-4 text-[var(--primary)]"
        />
        <span className="min-w-0 flex-1 truncate">{value}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-labelledby={labelledBy}
          className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-xl"
        >
          {options.map((iconKey) => {
            const selected = iconKey === value;
            return (
              <button
                key={iconKey}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  selected
                    ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "hover:bg-[var(--surface-muted)]",
                )}
                onClick={() => {
                  onChange(iconKey);
                  setOpen(false);
                }}
              >
                <NavigationIcon iconKey={iconKey} className="size-4" />
                <span className="min-w-0 flex-1 truncate">{iconKey}</span>
                {selected ? <Check className="size-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
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
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
