#!/usr/bin/env node
/**
 * Live Polymarket Gamma API integration check.
 * Verifies the public API is reachable and returns parseable market data.
 *
 * Usage:
 *   node scripts/verify-gamma.mjs
 *   GAMMA_API_BASE=https://gamma-api.polymarket.com node scripts/verify-gamma.mjs
 */
const BASE = process.env.GAMMA_API_BASE ?? "https://gamma-api.polymarket.com";

function parseOutcomePrices(raw) {
  let prices = [];
  if (typeof raw === "string") {
    try {
      prices = JSON.parse(raw);
    } catch {
      prices = raw.split(",").map((v) => v.trim());
    }
  } else if (Array.isArray(raw)) {
    prices = raw.map(String);
  }
  const yes = Number(prices[0]);
  return Number.isFinite(yes) ? yes : 0.5;
}

async function main() {
  const url = new URL("/markets", BASE);
  url.searchParams.set("limit", "5");
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");

  console.log(`\nPolymarket Gamma API check → ${url}\n`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Gamma API returned ${response.status}`);
  }

  const markets = await response.json();
  if (!Array.isArray(markets) || markets.length === 0) {
    throw new Error("Gamma API returned no markets");
  }

  const valid = markets.filter((m) => m.id && m.question);
  if (valid.length === 0) {
    throw new Error("No markets with id + question fields");
  }

  const sample = valid[0];
  const yesPrice = parseOutcomePrices(sample.outcomePrices);
  if (yesPrice < 0 || yesPrice > 1) {
    throw new Error(`Invalid yes price parsed: ${yesPrice}`);
  }

  console.log(`✓ Fetched ${valid.length} markets`);
  console.log(`✓ Sample: [${sample.id}] ${sample.question.slice(0, 60)}…`);
  console.log(`✓ Parsed yes price: ${yesPrice}`);
  console.log("\n✓ Gamma API integration OK\n");
}

main().catch((error) => {
  console.error(`\n✗ Gamma API check failed: ${error.message}\n`);
  process.exit(1);
});