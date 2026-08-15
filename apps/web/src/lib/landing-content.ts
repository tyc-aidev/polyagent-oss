export const site = {
  name: "PolyAgent OSS",
  tagline: "Paper trade prediction-market bots — open source, self-hostable.",
  description:
    "Connect to public Polymarket market data, run threshold agents on a schedule, and review paper P&L and decision traces. Educational and research use only.",
  disclaimer: "Paper trading only. Not financial advice. No live order execution.",
  github: "https://github.com/tyc-aidev/polyagent-oss",
} as const;

export const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
] as const;

export const hero = {
  eyebrow: "Open source · Paper trading",
  title: "Run prediction-market agents without risking capital",
  subtitle:
    "PolyAgent OSS simulates bot strategies against live Polymarket Gamma data. Explore markets, discover catalog alphas, backtest on stored snapshots, and inspect every paper decision.",
  primaryCta: { href: "/markets", label: "Open dashboard" },
  secondaryCta: { href: "/demo", label: "View demo" },
} as const;

export const stats = [
  { label: "Trading mode", value: "Paper only" },
  { label: "Market data", value: "Polymarket Gamma" },
  { label: "Deploy", value: "Docker or Cloudflare" },
  { label: "License", value: "Open source" },
] as const;

export const features = [
  {
    title: "Threshold and catalog agents",
    description:
      "Rule-based threshold bots, or live catalog alphas that use the same evaluator as the backtest engine.",
  },
  {
    title: "Paper portfolio & P&L",
    description:
      "Simulated cash, positions, and mark-to-market P&L so you can evaluate strategies safely.",
  },
  {
    title: "Market explorer",
    description:
      "Browse live Polymarket markets, prices, and volume before wiring them into a bot.",
  },
  {
    title: "Alpha lab",
    description:
      "Discover catalog signals, compute market features, and backtest alphas against imported or tick-captured snapshots.",
  },
  {
    title: "Scheduled ticks",
    description:
      "Run bots every few minutes via in-process scheduler (Docker) or Cron + Queues (Cloudflare).",
  },
  {
    title: "Decision traces",
    description:
      "Every tick records actions and reasoning so you can audit why a bot held, bought, or sold.",
  },
  {
    title: "Self-host anywhere",
    description:
      "Full stack with Docker Compose, or edge deploy on Cloudflare Workers with OpenNext.",
  },
] as const;

export const steps = [
  {
    step: "1",
    title: "Explore markets",
    description: "Pull live market snapshots from the public Gamma API and pick IDs for your bot.",
  },
  {
    step: "2",
    title: "Configure an agent",
    description: "Set thresholds, size, and risk limits — or start from the seeded demo bot.",
  },
  {
    step: "3",
    title: "Tick & review",
    description: "Run manual or scheduled ticks, then inspect portfolio, positions, and decisions.",
  },
  {
    step: "4",
    title: "Discover & backtest alphas",
    description:
      "Score the catalog on a market, then replay paper P&L on stored snapshots before promoting a rule.",
  },
] as const;

export const faqs = [
  {
    question: "Does PolyAgent place real trades?",
    answer:
      "No. All activity is paper trading only. There are no wallets, private keys, or live order execution paths.",
  },
  {
    question: "Where does market data come from?",
    answer:
      "Public Polymarket Gamma API. Responses can be cached (in-memory locally, KV on Cloudflare).",
  },
  {
    question: "Can I self-host?",
    answer:
      "Yes. Use Docker Compose for a local or VPS stack, or deploy the Next.js app to Cloudflare Workers via OpenNext.",
  },
  {
    question: "Is the dashboard protected?",
    answer:
      "Optionally. Set DASHBOARD_PASSWORD for a simple password gate on public deploys. Internal cron routes use CRON_SECRET.",
  },
  {
    question: "Can I backtest an alpha?",
    answer:
      "Yes. The Alpha Lab and POST /api/backtests replay catalog signals on stored or imported snapshots using the paper simulator. Fills are mid-price only — see the report limitations.",
  },
] as const;

export const cta = {
  title: "Ready to paper trade?",
  subtitle: "Open the dashboard to explore markets and run the demo bot.",
  primaryCta: { href: "/markets", label: "Open dashboard" },
  secondaryCta: { href: "/demo", label: "View demo" },
} as const;

export const footerLinks = [
  { href: "/markets", label: "Markets" },
  { href: "/alphas", label: "Alphas" },
  { href: "/bots", label: "Bots" },
  { href: "/demo", label: "Demo" },
  { href: "/login", label: "Sign in" },
] as const;
