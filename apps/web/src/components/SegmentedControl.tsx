interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  size?: "sm" | "md";
  className?: string;
}

/** A row of mutually exclusive choices (a radio group that looks like tabs). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  size = "md",
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`surface-inset flex gap-1 p-1 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-lg font-semibold outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-accent-400/60 ${
              size === "sm" ? "h-7 text-xs" : "h-8 text-[13px]"
            } ${
              active
                ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.4)]"
                : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
