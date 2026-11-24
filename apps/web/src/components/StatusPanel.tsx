import type { IconName } from "@dailyloop/shared";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

const TONES = {
  neutral: "border-white/[0.1] bg-white/[0.04] text-accent-300",
  warning: "border-amber-400/25 bg-amber-400/10 text-amber-300",
} as const;

/** A full-panel message: not found, crashed, nothing here. */
export function StatusPanel({
  icon,
  tone = "neutral",
  code,
  title,
  children,
  actions,
  role,
}: {
  icon: IconName;
  tone?: keyof typeof TONES;
  /** A short mono tag above the title, e.g. "404". */
  code?: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  role?: "alert";
}) {
  return (
    <div
      role={role}
      className="glass-strong relative mx-auto w-full max-w-md overflow-hidden px-6 py-10 text-center sm:px-10"
    >
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-brand-500/25 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative flex flex-col items-center">
        <span
          className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border ${TONES[tone]}`}
        >
          <Icon name={icon} className="text-3xl" filled />
        </span>
        {code ? <p className="eyebrow mb-2 text-white/40">{code}</p> : null}
        <h1 className="font-display text-xl font-bold text-white sm:text-2xl">{title}</h1>
        {children ? <div className="mt-2 text-sm text-white/55">{children}</div> : null}
        {actions ? (
          <div className="mt-7 flex w-full flex-col gap-2 sm:w-auto">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
