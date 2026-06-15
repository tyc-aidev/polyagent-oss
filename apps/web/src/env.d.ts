// Project-specific Cloudflare binding extensions (merged with generated cloudflare-env.d.ts).
interface CloudflareEnv {
  MARKET_CACHE?: KVNamespace;
  TICK_QUEUE?: Queue<{ botId: string }>;
  CRON_SECRET?: string;
  HYPERDRIVE?: Hyperdrive;
}