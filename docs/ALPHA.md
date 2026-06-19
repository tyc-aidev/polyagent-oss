# Alpha Release Checklist (v0.1.0)

Use this checklist to verify the MVP before tagging a release.

## Docker path

```bash
docker compose up postgres -d
pnpm install
pnpm db:setup
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

GitHub Actions deploy secrets: see [DEPLOY_SECRETS.md](./DEPLOY_SECRETS.md).

## Definition of Done

- [x] Demo bot visible at `/demo` after seed
- [x] Create → activate → tick → decisions with reasoning
- [x] Portfolio cash balance and P&L update after ticks
- [x] Cron/scheduler enqueues or runs ticks
- [x] Disclaimer banner on dashboard pages
- [x] `pnpm test` passes (55+ unit tests; integration tests in CI smoke job)
- [x] No live order execution code paths
- [x] README covers Docker and Cloudflare deploy

## Release

- [x] Git tag `v0.1.0` pushed
- [x] GitHub Release published: https://github.com/tyc-aidev/polyagent-oss/releases/tag/v0.1.0