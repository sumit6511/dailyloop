import { forwardRef, type InputHTMLAttributes } from "react";
import { Icon } from "./Icon";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  /** Optional Material Symbols icon name, shown inside the field on the left. */
  icon?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, icon, id, className = "", ...props }, ref) => {
    const fieldId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium text-white/80">
          {label}
        </label>
        <div className="relative">
          {icon ? (
            <Icon name={icon} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-white/40" />
          ) : null}
          <input
            ref={ref}
            id={fieldId}
            className={`w-full rounded-xl border bg-white/[0.05] py-2.5 text-sm text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] outline-none transition-colors placeholder:text-white/35 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 ${
              icon ? "pl-10 pr-3.5" : "px-3.5"
            } ${error ? "border-rose-400/60" : "border-white/[0.12]"} ${className}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${fieldId}-error` : undefined}
            {...props}
          />
        </div>
        {error ? (
          <p id={`${fieldId}-error`} className="text-xs font-medium text-rose-400">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
TextField.displayName = "TextField";
