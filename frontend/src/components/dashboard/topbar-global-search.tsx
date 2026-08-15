"use client";

import {
  ArrowRight,
  LoaderCircle,
  PackageSearch,
  PanelsTopLeft,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getBakeryProducts,
  type BakeryProduct,
  type NavigationTreeItem,
} from "@/lib/api";

type TopbarGlobalSearchProps = {
  locale: "zh-CN" | "en-GB";
  navigationItems: NavigationTreeItem[];
};

type SearchPage = {
  id: string;
  label: string;
  secondaryLabel: string;
  path: string;
};

function flattenPages(
  items: NavigationTreeItem[],
  locale: "zh-CN" | "en-GB",
): SearchPage[] {
  return items.flatMap((item) => {
    const current =
      item.item_type === "PAGE" && item.frontend_path
        ? [
            {
              id: item.id,
              label: locale === "en-GB" ? item.label_en : item.label_zh,
              secondaryLabel:
                locale === "en-GB" ? item.label_zh : item.label_en,
              path: item.frontend_path,
            },
          ]
        : [];
    return [...current, ...flattenPages(item.children, locale)];
  });
}

export function TopbarGlobalSearch({
  locale,
  navigationItems,
}: TopbarGlobalSearchProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<BakeryProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const isEnglish = locale === "en-GB";

  const pages = useMemo(
    () => flattenPages(navigationItems, locale),
    [locale, navigationItems],
  );

  const normalisedQuery = query.trim().toLocaleLowerCase(locale);
  const pageResults = useMemo(() => {
    if (!normalisedQuery) return pages.slice(0, 6);
    return pages
      .filter((page) =>
        `${page.label} ${page.secondaryLabel}`
          .toLocaleLowerCase(locale)
          .includes(normalisedQuery),
      )
      .slice(0, 6);
  }, [locale, normalisedQuery, pages]);
  const productResults = useMemo(() => {
    if (!normalisedQuery) return [];
    return products
      .filter((product) =>
        `${product.code} ${product.name_zh} ${product.name_en}`
          .toLocaleLowerCase(locale)
          .includes(normalisedQuery),
      )
      .slice(0, 6);
  }, [locale, normalisedQuery, products]);

  const openSearch = useCallback(() => {
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
      if (event.key === "Escape") setOpen(false);
    }
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", handleShortcut);
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("keydown", handleShortcut);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [openSearch]);

  useEffect(() => {
    if (!open || productsLoaded || productsLoading) return;
    const timer = window.setTimeout(() => {
      setProductsLoading(true);
      void getBakeryProducts()
        .then(setProducts)
        .catch(() => setProducts([]))
        .finally(() => {
          setProductsLoaded(true);
          setProductsLoading(false);
        });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, productsLoaded, productsLoading]);

  function navigate(path: string) {
    router.push(path);
    setOpen(false);
    setQuery("");
  }

  const noResults =
    normalisedQuery &&
    !productsLoading &&
    pageResults.length === 0 &&
    productResults.length === 0;

  return (
    <div ref={containerRef} className="relative mx-2 shrink-0 md:mx-5 md:w-full md:max-w-sm">
      <button
        type="button"
        className="grid size-9 place-items-center rounded-lg text-[var(--foreground)] transition-colors hover:bg-black/5 md:hidden"
        aria-label={isEnglish ? "Global search" : "全局搜索"}
        onClick={openSearch}
      >
        <Search className="size-[18px]" />
      </button>

      <label className="relative hidden md:block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          ref={inputRef}
          value={query}
          aria-label={isEnglish ? "Global search" : "全局搜索"}
          placeholder={isEnglish ? "Search features or products..." : "搜索功能或产品..."}
          className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--card)]/90 pr-16 pl-9 text-sm outline-none backdrop-blur transition-colors placeholder:text-[var(--muted)] focus:border-[var(--primary-border)] focus:ring-2 focus:ring-[var(--primary-ring)]"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
        />
        {query ? (
          <button
            type="button"
            className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)]"
            aria-label={isEnglish ? "Clear search" : "清空搜索"}
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <kbd className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
            ⌘ K
          </kbd>
        )}
      </label>

      {open ? (
        <div className="fixed top-16 right-3 left-3 z-50 max-h-[min(70vh,32rem)] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 shadow-2xl md:absolute md:top-11 md:right-0 md:left-0">
          <div className="relative mb-2 md:hidden">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              ref={inputRef}
              value={query}
              aria-label={isEnglish ? "Global search" : "全局搜索"}
              placeholder={isEnglish ? "Search features or products..." : "搜索功能或产品..."}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {pageResults.length ? (
            <SearchGroup title={isEnglish ? "Features" : "功能"}>
              {pageResults.map((page) => (
                <SearchResult
                  key={page.id}
                  icon={<PanelsTopLeft className="size-4" />}
                  title={page.label}
                  subtitle={page.secondaryLabel}
                  onClick={() => navigate(page.path)}
                />
              ))}
            </SearchGroup>
          ) : null}

          {productsLoading && normalisedQuery ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-[var(--muted)]">
              <LoaderCircle className="size-4 animate-spin" />
              {isEnglish ? "Searching products..." : "正在搜索产品..."}
            </div>
          ) : null}

          {productResults.length ? (
            <SearchGroup title={isEnglish ? "Products" : "产品"}>
              {productResults.map((product) => {
                const name = isEnglish ? product.name_en : product.name_zh;
                const secondaryName = isEnglish ? product.name_zh : product.name_en;
                return (
                  <SearchResult
                    key={product.id}
                    icon={<PackageSearch className="size-4" />}
                    title={name}
                    subtitle={`${product.code} · ${secondaryName}`}
                    onClick={() =>
                      navigate(
                        `/products/product-recipes?search=${encodeURIComponent(name)}`,
                      )
                    }
                  />
                );
              })}
            </SearchGroup>
          ) : null}

          {noResults ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">
              {isEnglish ? "No matching results" : "没有匹配结果"}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SearchGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-1">
      <p className="px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)]">
        {title}
      </p>
      <div>{children}</div>
    </section>
  );
}

function SearchResult({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-muted)]"
      onClick={onClick}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-[var(--muted)]">{subtitle}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
