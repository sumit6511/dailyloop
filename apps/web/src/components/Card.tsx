import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** glass-medium is the default; use "subtle" for dense/secondary panels, "strong" for
   * anything that needs to stand out above other glass surfaces (e.g. a highlighted panel). */
  intensity?: "subtle" | "medium" | "strong";
}

const INTENSITY_CLASSES: Record<NonNullable<CardProps["intensity"]>, string> = {
  subtle: "glass-subtle",
  medium: "glass-medium",
  strong: "glass-strong",
};

export function Card({ className = "", intensity = "medium", ...props }: CardProps) {
  return <div className={`${INTENSITY_CLASSES[intensity]} p-6 ${className}`} {...props} />;
}
