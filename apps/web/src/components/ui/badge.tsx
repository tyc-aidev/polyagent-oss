import { cn } from "@/lib/utils";

const styles = {
  active: "bg-success-muted text-success-foreground border-success/30",
  paused: "bg-warning-muted text-warning-foreground border-warning/30",
  archived: "bg-muted text-muted-foreground border-border",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  completed: "bg-success-muted text-success-foreground border-success/30",
  running: "bg-info-muted text-info-foreground border-info/30",
  pending: "bg-muted text-muted-foreground border-border",
};

export function Badge({
  status,
  className,
}: {
  status: keyof typeof styles;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        styles[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
