import { forwardRef, type InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, id, className = "", ...props }, ref) => {
    const fieldId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium text-white/80">
          {label}
        </label>
        <input
          ref={ref}
          id={fieldId}
          className={`rounded-xl border bg-white/[0.05] px-3.5 py-2.5 text-sm text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] outline-none transition-colors placeholder:text-white/35 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 ${
            error ? "border-rose-400/60" : "border-white/[0.12]"
          } ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          {...props}
        />
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
