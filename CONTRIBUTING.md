# Contributing to PolyAgent OSS

Thank you for your interest in contributing!

## Testing

- `pnpm test` — unit tests (fast, no database required)
- `pnpm --filter @polyagent/web test:integration` — HTTP-level API tests (requires `DATABASE_URL` and migrated DB)
- `pnpm smoke` — end-to-end Docker path (running server)
- `pnpm smoke:cloudflare` — production Worker verification

Integration tests run automatically in the CI smoke job after `pnpm db:setup`.

## Development setup

```bash
cp .env.example .env
docker compose up postgres -d
pnpm install
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

## Before submitting a PR

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Scope guidelines (MVP)

- **Paper trading only** — no live execution, wallet integration, or private key handling.
- **ThresholdAgent only** — LLM and multi-agent features are Phase 2.
- **PostgreSQL via Prisma** — no D1 or alternate databases.
- Keep changes focused; avoid unrelated refactors.

## Commit style

Use small, logical commits with clear messages:

```
feat(scheduler): add Cloudflare queue enqueue path
fix(auth): use signed session tokens
docs: add Docker self-host README
```

## Reporting issues

Include:

- Steps to reproduce
- Expected vs actual behavior
- Environment (Docker, Cloudflare, local dev)
- Relevant logs (redact secrets)

## Code of conduct

Be respectful and constructive. We are building educational tooling for the prediction market research community.