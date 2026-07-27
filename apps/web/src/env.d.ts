// Project-specific Cloudflare binding extensions (merged with generated cloudflare-env.d.ts).
interface CloudflareEnv {
  WORKER_SELF_REFERENCE?: Fetcher;
  MARKET_CACHE?: KVNamespace;
  TICK_QUEUE?: Queue<{ botId: string }>;
  CRON_SECRET?: string;
  DATABASE_URL?: string;
  DASHBOARD_PASSWORD?: string;
  SESSION_SECRET?: string;
  SCHEDULER_MODE?: string;
}
