# Security Checklist (Production)

Use this checklist before exposing a PolyAgent instance to the public internet.

## Required for public deploys

- [ ] Set `DASHBOARD_PASSWORD` to a strong, unique value
- [ ] Set `SESSION_SECRET` to a separate random 32+ character string (do not reuse the dashboard password)
- [ ] Set `CRON_SECRET` to a random 32+ character string
- [ ] Use Cloudflare Hyperdrive (or another connection pooler) for Cloudflare deploys
- [ ] Run migrations with `pnpm db:migrate:deploy` before deploy

## Authentication

- Session cookies are **signed HMAC tokens** (not plaintext passwords)
- Cookies are `httpOnly`, `sameSite=lax`, and `secure` in production
- Internal scheduler routes (`/api/internal/*`) use `x-cron-secret` header auth and bypass the dashboard gate

## Rate limiting

In-memory rate limits apply per IP:

| Route | Limit |
|-------|-------|
| `GET /api/markets` | 60/min |
| `POST /api/bots` | 20/min |
| `POST /api/bots/:id/tick` | 10/min |
| `POST /api/auth/login` | 10/min |

On Cloudflare at scale, consider adding Workers Rate Limiting bindings for distributed enforcement.

## Request limits

- POST bodies are capped at 64 KB

## Security headers

All responses include:

- `Content-Security-Policy` (baseline)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (restricts camera, microphone, geolocation)

## What this MVP does not include

- Multi-user auth or role-based access control
- CSRF tokens (mitigated by `SameSite=lax` cookies for same-origin dashboard use)
- Distributed rate limiting (in-memory only; resets on Worker cold start)
- Audit logging

## Reporting vulnerabilities

Please report security issues privately to the repository maintainers rather than opening public issues.