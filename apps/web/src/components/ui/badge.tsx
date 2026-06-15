import { cn } from "@/lib/utils";

const styles = {
  active: "bg-green-500/20 text-green-300 border-green-500/30",
  paused: "bg-amber-500/20 text-amber-200 border-amber-500/30",
  archived: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  failed: "bg-red-500/20 text-red-300 border-red-500/30",
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
  running: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  pending: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
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