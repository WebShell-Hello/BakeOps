"use client";

import { CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "info";

type ToastMessage = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showSuccess: (message: string) => void;
  showInfo: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const nextId = useRef(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone) => {
    nextId.current += 1;
    setToast({ id: nextId.current, message, tone });
  }, []);

  const showSuccess = useCallback(
    (message: string) => showToast(message, "success"),
    [showToast],
  );
  const showInfo = useCallback(
    (message: string) => showToast(message, "info"),
    [showToast],
  );

  return (
    <ToastContext.Provider value={{ showSuccess, showInfo }}>
      {children}
      {toast ? (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={() =>
            setToast((current) => (current?.id === toast.id ? null : current))
          }
        />
      ) : null}
    </ToastContext.Provider>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: () => void;
}) {
  const dismissTimer = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimer.current !== null) {
      window.clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  const beginDismiss = useCallback(() => {
    if (closing) return;
    clearDismissTimer();
    setClosing(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 160;
    window.setTimeout(onDismiss, delay);
  }, [clearDismissTimer, closing, onDismiss]);

  const startDismissTimer = useCallback(() => {
    if (closing) return;
    clearDismissTimer();
    dismissTimer.current = window.setTimeout(beginDismiss, 2000);
  }, [beginDismiss, clearDismissTimer, closing]);

  useEffect(() => {
    startDismissTimer();
    return () => {
      clearDismissTimer();
    };
  }, [clearDismissTimer, startDismissTimer]);

  const Icon = toast.tone === "success" ? CheckCircle2 : Info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed right-4 bottom-4 z-[90] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm shadow-2xl sm:right-6 sm:bottom-6",
        closing ? "toast-exit" : "toast-enter",
      )}
      onMouseEnter={clearDismissTimer}
      onMouseLeave={startDismissTimer}
    >
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          toast.tone === "success"
            ? "text-emerald-500"
            : "text-[var(--primary)]",
        )}
      />
      <span className="min-w-0 flex-1 leading-5 text-[var(--foreground)]">
        {toast.message}
      </span>
      <button
        type="button"
        className="grid size-6 shrink-0 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
        aria-label="关闭通知 / Dismiss notification"
        onClick={beginDismiss}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
