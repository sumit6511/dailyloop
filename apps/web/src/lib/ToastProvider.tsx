import type { IconName } from "@dailyloop/shared";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastContext, type ToastVariant } from "./toast-context";
import { Icon } from "../components/Icon";

interface ToastEntry {
  id: number;
  message: string;
  variant: ToastVariant;
  leaving?: boolean;
}

const AUTO_DISMISS_MS = 3500;
// Matches the animate-toast-out duration in index.css — the toast is removed from the DOM
// only after its exit animation finishes, instead of vanishing instantly.
const EXIT_MS = 180;

// The surface is the shared elevated glass; the variant shows in the icon chip.
const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "bg-emerald-400/15 text-emerald-300",
  error: "bg-rose-400/15 text-rose-300",
  info: "bg-accent-400/15 text-accent-300",
};

const VARIANT_ICON: Record<ToastVariant, IconName> = {
  success: "check_circle",
  error: "error",
  info: "info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_MS);
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`${toast.leaving ? "animate-toast-out" : "animate-toast-in"} glass-strong pointer-events-auto flex w-full max-w-sm items-center gap-3 py-2.5 pl-2.5 pr-3 text-sm font-medium text-white`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${VARIANT_CLASSES[toast.variant]}`}
            >
              <Icon name={VARIANT_ICON[toast.variant]} className="text-lg" filled />
            </span>
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Icon name="close" className="text-base" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
