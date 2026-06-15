# Alpha Release Checklist (v0.1.0)

Use this checklist to verify the MVP before tagging a release.

## Docker path

```bash
docker compose up postgres -d
pnpm install
pnpm db:migrate:deploy
pnpm db:seed
DATABASE_URL=postgresql://polyagent:polyagent@localhost:5432/polyagent \
  CRON_SECRET=your-secret pnpm --filter @polyagent/web start
CRON_SECRET=your-secret pnpm smoke
```

All smoke steps should pass.

## Cloudflare path

After deploy (see [CLOUDFLARE.md](./CLOUDFLARE.md)):

```bash
SMOKE_BASE_URL=https://your-worker.workers.dev \
CRON_SECRET=... \
DASHBOARD_PASSWORD=... \
pnpm smoke:cloudflare
```

## Definition of Done

- [ ] Demo bot visible at `/demo` after seed
- [ ] Create → activate → tick → decisions with reasoning
- [ ] Portfolio cash balance and P&L update after ticks
- [ ] Cron/scheduler enqueues or runs ticks
- [ ] Disclaimer banner on dashboard pages
- [ ] `pnpm test` passes (49+ tests)
- [ ] No live order execution code paths
- [ ] README covers Docker and Cloudflare deploy

## Tag release

```bash
git tag -a v0.1.0 -m "PolyAgent OSS v0.1.0 — paper trading alpha"
git push origin v0.1.0
```