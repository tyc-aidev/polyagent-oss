import { schedule, type ScheduledTask } from "node-cron";
import { runActiveBotTicks } from "@/lib/runner/tick";

/** Matches Cloudflare Worker cron in wrangler.jsonc. */
export const DOCKER_CRON_EXPRESSION = "*/5 * * * *";

let task: ScheduledTask | null = null;
let shuttingDown = false;

function attachShutdownHooks(): void {
  const stop = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopDockerScheduler();
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

export function startDockerScheduler(): void {
  if (task || process.env.SCHEDULER_MODE !== "docker") return;

  task = schedule(DOCKER_CRON_EXPRESSION, () => {
    runActiveBotTicks().catch((error) => {
      console.error("[scheduler] tick batch failed:", error);
    });
  });

  attachShutdownHooks();
  console.log(`[scheduler] Docker scheduler started (${DOCKER_CRON_EXPRESSION})`);
}

export function stopDockerScheduler(): void {
  if (!task) return;
  void task.stop();
  task = null;
  console.log("[scheduler] Docker scheduler stopped");
}
