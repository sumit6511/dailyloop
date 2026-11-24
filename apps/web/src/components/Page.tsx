import type { ReactNode } from "react";

const WIDTHS = {
  /** Forms and single-column pages: settings, friends, profile. */
  narrow: "max-w-3xl",
  /** The full content width, matching the header. */
  full: "max-w-none",
} as const;

/** A page's outer column: its width and the vertical rhythm between sections. */
export function Page({
  width = "full",
  className = "",
  children,
}: {
  width?: keyof typeof WIDTHS;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto flex w-full flex-col gap-6 sm:gap-8 ${WIDTHS[width]} ${className}`}>
      {children}
    </div>
  );
}
