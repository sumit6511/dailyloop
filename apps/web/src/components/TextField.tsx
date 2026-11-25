import type { IconName } from "@dailyloop/shared";
import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import { Icon } from "./Icon";
import { FIELD_BORDER, FIELD_BORDER_ERROR, FIELD_CLASSES } from "./field-styles";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  /** Optional Material Symbols icon name, shown inside the field on the left. */
  icon?: IconName;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, icon, id, className = "", type, ...props }, ref) => {
    // Every field needs an id for its <label htmlFor> — without one (no id or name passed) the label
    // isn't linked and screen readers announce an unlabelled input.
    const autoId = useId();
    const fieldId = id ?? props.name ?? autoId;
    const isPassword = type === "password";
    const [revealed, setRevealed] = useState(false);

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-[13px] font-medium text-white/75">
          {label}
        </label>
        <div className="group relative">
          {icon ? (
            <Icon
              name={icon}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-white/35 transition-colors group-focus-within:text-accent-300"
            />
          ) : null}
          <input
            ref={ref}
            id={fieldId}
            type={isPassword && revealed ? "text" : type}
            className={`${FIELD_CLASSES} ${icon ? "pl-10" : "pl-3.5"} ${isPassword ? "pr-11" : "pr-3.5"} ${
              error ? FIELD_BORDER_ERROR : FIELD_BORDER
            } ${className}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${fieldId}-error` : undefined}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              aria-label={revealed ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-fg-subtle outline-none transition-colors hover:bg-white/[0.06] hover:text-white/75 focus-visible:text-white/75 focus-visible:ring-2 focus-visible:ring-accent-400/40"
            >
              <Icon name={revealed ? "visibility_off" : "visibility"} className="text-lg" />
            </button>
          ) : null}
        </div>
        {error ? (
          <p
            id={`${fieldId}-error`}
            className="flex items-center gap-1 text-xs font-medium text-rose-300"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
TextField.displayName = "TextField";
