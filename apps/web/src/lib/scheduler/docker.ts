import { runActiveBotTicks } from "@/lib/runner/tick";

let started = false;

export function startDockerScheduler(): void {
  if (started || process.env.SCHEDULER_MODE !== "docker") return;
  started = true;

  const intervalMs = 5 * 60 * 1000;
  console.log("[scheduler] Docker scheduler started (every 5 minutes)");

  setInterval(() => {
    runActiveBotTicks().catch((error) => {
      console.error("[scheduler] tick batch failed:", error);
    });
  }, intervalMs);
}