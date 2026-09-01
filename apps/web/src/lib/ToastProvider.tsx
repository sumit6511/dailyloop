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

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "border-emerald-400/30 text-emerald-200",
  error: "border-rose-400/30 text-rose-200",
  info: "border-brand-400/30 text-brand-200",
};

const VARIANT_ICON: Record<ToastVariant, string> = {
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
            className={`${toast.leaving ? "animate-toast-out" : "animate-toast-in"} glass-strong pointer-events-auto flex max-w-sm items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-white ${VARIANT_CLASSES[toast.variant]}`}
          >
            <Icon name={VARIANT_ICON[toast.variant]} className="text-lg" filled />
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="text-white/50 transition-colors hover:text-white"
            >
              <Icon name="close" className="text-base" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
