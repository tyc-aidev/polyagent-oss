export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SCHEDULER_MODE === "docker") {
    const { startDockerScheduler } = await import("@/lib/scheduler/docker");
    startDockerScheduler();
  }
}