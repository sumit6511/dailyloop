import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Buttons along the bottom; a close (×) button is always in the corner. */
  footer?: ReactNode;
  className?: string;
}

/** A modal on the native <dialog>: focus trap, Escape and the backdrop all close it. */
export function Dialog({ open, onClose, title, children, footer, className = "" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={`glass-strong m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto p-6 text-white backdrop:bg-ink-950/75 backdrop:backdrop-blur-sm sm:p-7 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="font-display text-xl font-bold text-white">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fg-subtle outline-none transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-accent-400/60"
        >
          <Icon name="close" className="text-xl" />
        </button>
      </div>
      <div className="mt-4">{children}</div>
      {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
    </dialog>
  );
}
