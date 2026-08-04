import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "border-warning/40 bg-warning-muted text-warning-foreground",
  warning: "border-warning/40 bg-warning-muted text-warning-foreground",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-info/40 bg-info-muted text-info-foreground",
} as const;

export function Alert({
  className,
  children,
  variant = "warning",
}: {
  className?: string;
  children: ReactNode;
  variant?: keyof typeof variants;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm leading-relaxed",
        variants[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
