import { afterEach, describe, expect, it, vi } from "vitest";

const schedule = vi.fn();
const stop = vi.fn();

vi.mock("node-cron", () => ({
  schedule: (...args: unknown[]) => {
    schedule(...args);
    return { stop };
  },
}));

vi.mock("@/lib/runner/tick", () => ({
  runActiveBotTicks: vi.fn().mockResolvedValue(undefined),
}));

describe("docker scheduler", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("does not start unless SCHEDULER_MODE is docker", async () => {
    vi.stubEnv("SCHEDULER_MODE", "cloudflare");
    const { startDockerScheduler } = await import("./docker");
    startDockerScheduler();
    expect(schedule).not.toHaveBeenCalled();
  });

  it("schedules */5 * * * * and stops cleanly", async () => {
    vi.stubEnv("SCHEDULER_MODE", "docker");
    const { startDockerScheduler, stopDockerScheduler, DOCKER_CRON_EXPRESSION } =
      await import("./docker");
    startDockerScheduler();
    expect(schedule).toHaveBeenCalledWith(DOCKER_CRON_EXPRESSION, expect.any(Function));
    stopDockerScheduler();
    expect(stop).toHaveBeenCalled();
  });
});
