import { Badge } from "@/components/ui/badge";

export function BotStatusBadge({ status }: { status: string }) {
  const key =
    status === "active" || status === "paused" || status === "archived"
      ? status
      : "paused";
  return <Badge status={key} />;
}