interface SkeletonProps {
  className?: string;
  shape?: "line" | "block" | "circle";
}

const SHAPE_CLASSES: Record<NonNullable<SkeletonProps["shape"]>, string> = {
  line: "h-3 rounded-full",
  block: "rounded-2xl",
  circle: "rounded-full",
};

export function Skeleton({ className = "w-full", shape = "line" }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer bg-white/[0.06] ${SHAPE_CLASSES[shape]} ${className}`}
      aria-hidden="true"
    />
  );
}
