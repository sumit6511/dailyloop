import { useEffect, useRef } from "react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClose={onCancel}
      onClick={(event) => {
        if (event.target === ref.current) onCancel();
      }}
      className="glass-strong m-auto max-w-sm border-white/[0.18] bg-slate-900/90 p-6 text-white backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm"
    >
      <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
      {body ? <p className="mt-2 text-sm text-white/60">{body}</p> : null}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} type="button">
          {cancelLabel}
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} isLoading={isLoading} type="button">
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
