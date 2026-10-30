# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Send a private report to the maintainer via X ([@0xkillcoin](https://x.com/0xkillcoin)) with:

- a description of the issue and its impact,
- reproduction steps or a proof of concept,
- the deployment or commit you tested against.

You will get an acknowledgement as soon as possible, and credit in the fix note unless you prefer otherwise.

## Scope

In scope:

- authentication and session handling (`src/worker/auth`, `src/worker/api.ts`),
- authorisation boundaries, especially admin routes and bill ownership,
- payment state transitions and fund accounting (`src/worker/core/service.ts`),
- receipt storage and private object access,
- injection, SSRF, XSS, CSRF, rate-limit bypass.

Out of scope for this repository:

- the absence of KYC/identity verification (a documented product limitation),
- sandbox payments not moving real money (by design),
- the seeded demo accounts — rotate them before any real deployment,
- denial of service through raw traffic volume.

## Built-in protections

| Control | Where |
| --- | --- |
| PBKDF2-SHA256 (60k iterations, per-user salt) | `src/worker/auth/crypto.ts` |
| HTTP-only, SameSite=Lax, Secure session cookie | `src/worker/api.ts` |
| Server-side role checks on every admin route | `src/worker/api.ts` (`admin.use('*')`) |
| Ownership checks in the service layer | `src/worker/core/service.ts` |
| Magic-byte file validation + SHA-256 dedupe | `src/worker/api.ts` (`/receipts`) |
| Private receipt access, `no-store` | `src/worker/api.ts` (`/media/private/*`) |
| Durable rate limits | `src/worker/lib/ratelimit.ts` |
| Idempotency + single-settlement guarantees | `src/worker/core/service.ts` (`settlePayment`) |
| Append-only audit log | `src/worker/core/notifications.ts` (`audit`) |
| Security headers on every response | `src/worker/index.ts` |

## Known limitations you should weigh before deploying

- Email verification is implemented but not enforced in the demo configuration.
- Receipt redaction is the uploader's responsibility; there is no automatic PII detection inside images.
- The bootstrap admin password is seeded — set `ADMIN_PASSWORD` (and preferably `ADMIN_EMAIL`) via `wrangler secret` and restart.
- `DEBUG_ERRORS=true` leaks exception detail in API errors. Keep it `false` in public deployments.
