import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  "aria-label"?: string;
}

/**
 * A custom dropdown replacing native <select> — the popup list of a native select can't be
 * themed at all (no glass surface, no dark colors we control), so it always looks like a
 * jarring light-mode box dropped onto this otherwise fully dark/glass UI.
 */
export function Select({ value, onChange, options, className = "", "aria-label": ariaLabel }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open) return;
    function updateRect() {
      const el = containerRef.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      setRect({ top: box.bottom + 6, left: box.left, width: box.width });
    }
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex min-w-[9rem] items-center justify-between gap-2 rounded-xl border border-white/[0.12] bg-white/[0.05] px-3.5 py-2.5 text-sm text-white outline-none transition-colors hover:bg-white/[0.08] focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-400/30"
      >
        <span className="truncate">{selected?.label ?? "Select…"}</span>
        <Icon
          name="expand_more"
          className={`text-lg text-white/50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && rect
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              style={{ top: rect.top, left: rect.left, minWidth: rect.width }}
              className="glass-strong fixed z-50 max-h-64 w-max overflow-y-auto p-1"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    option.value === value ? "bg-brand-500/20 text-brand-200" : "text-white/80 hover:bg-white/[0.08]"
                  }`}
                >
                  {option.label}
                  {option.value === value ? <Icon name="check" className="text-base" /> : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
