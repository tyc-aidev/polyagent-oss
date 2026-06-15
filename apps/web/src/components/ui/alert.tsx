import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Alert({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100",
        className,
      )}
    >
      {children}
    </div>
  );
}