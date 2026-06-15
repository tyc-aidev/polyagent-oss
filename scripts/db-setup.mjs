#!/usr/bin/env node
/**
 * Idempotent database setup for CI/CD and deploy pipelines.
 *
 * - `prisma migrate deploy` is safe to re-run (applies only pending migrations)
 * - seed script skips creation when the demo bot already exists
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/db-setup.mjs
 *   DATABASE_URL=... node scripts/db-setup.mjs --skip-seed
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipSeed = process.argv.includes("--skip-seed");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

function run(label, command, args, cwd) {
  console.log(`\n→ ${label}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${result.status ?? "unknown"})`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ ${label}`);
}

console.log("PolyAgent database setup (idempotent)");

run(
  "Apply migrations (prisma migrate deploy)",
  "pnpm",
  ["--filter", "@polyagent/db", "migrate:deploy"],
  root,
);

if (!skipSeed) {
  run("Seed demo bot (skips if already present)", "pnpm", ["db:seed"], root);
} else {
  console.log("\n→ Seed skipped (--skip-seed)");
}

console.log("\n✓ Database setup complete\n");