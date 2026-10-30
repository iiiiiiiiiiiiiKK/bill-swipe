# Architecture

## Request path

```
Browser (React SPA)
   │
   ├─ GET /, /discover, /bills/…        → Workers Assets (dist/, SPA fallback)
   │
   └─ /api/*                            → Worker (Hono)
                                            │
                                            ├─ Zod validation + session cookie
                                            ├─ rate limiting (Durable Object)
                                            ├─ R2 put/get (receipt originals)
                                            └─ RPC → Core Durable Object
                                                        └─ SQLite (16 tables)
```

The Worker is intentionally thin: it owns HTTP concerns (cookies, validation, status codes, headers) and delegates every business write to the Durable Object, which is the only writer.

```
src/worker/index.ts   Worker entry — routing split + security headers
src/worker/api.ts     Hono app — all /api routes, auth middleware, error mapping
src/worker/core/      Durable Object — RPC dispatcher + domain services
src/worker/db/        Schema, migrations, typed query layer
src/worker/auth/      Password hashing, tokens, avatar seeds
src/worker/lib/       Serialisers, rate limiter
src/worker/seed/      Labelled demo dataset
```

## Why a Durable Object hosts the database

Cloudflare D1 is the obvious choice, but the free plan caps an account at 10 databases and this account had already reached it with other live projects. A **SQLite-backed Durable Object** gives:

- the same SQL semantics and schema,
- a **single writer**, which makes `raised_amount += amount` trivially atomic,
- transactions via `state.storage.transactionSync()` (the supported API — raw `BEGIN` is rejected by the runtime),
- no extra database to provision; the object *is* the database.

Trade-off: all writes serialize through one object, and the object lives in one location. That is a deliberate correctness-over-throughput choice at this scale, documented as a known limitation. Migrating to D1 or Postgres means reimplementing the ~60 lines in `src/worker/db/index.ts` and pointing the services at a different client.

## Domain services

`src/worker/core/service.ts` holds every business rule:

| Service | Responsibility |
| --- | --- |
| `registerUser` / `loginUser` / `resolveSession` | Accounts, PBKDF2 hashing, session issuance |
| `createBill` / `updateBill` / `closeBill` | Bill lifecycle, validation, risk pre-checks, locking |
| `discoverBills` | Feed query: verified + active, excludes own and swiped bills, blocks filtered |
| `recordSwipe` / `undoLastSwipe` | Intent capture (never a charge) |
| `createPaymentIntent` / `settlePayment` / `refundPayment` | Payment state machine and fund accounting |
| `reviewBill` / `adminSetUserStatus` / `adminResolveReport` | Moderation with audit logging |
| `communityFeed` / `toggleLike` / `addComment` | Social layer derived from real records |

Read models live in `queries.ts` so DTO shaping never leaks into HTTP handlers.

## State machines

**Bill**

```
draft → pending_review → approved → active → fully_funded
                │            │         │
                └→ rejected  └─────────┴→ suspended / closed
verification: unverified → pending → verified | rejected
```

**Payment**

```
pending → processing → succeeded → refunded
   └────────→ failed            └→ disputed
```

Invariants enforced in `settlePayment` (inside one transaction):

1. A payment can only settle once; replays return `alreadySettled`.
2. `bills.raised_amount` never exceeds `target_amount`; contributions are clamped to the remainder.
3. `bill_status` flips to `fully_funded` exactly when the target is met, and new intents are then refused.
4. `help_records`, notifications and the community post are created in the same transaction as the money movement.
5. Refunds decrement `raised_amount` and can reopen a `fully_funded` bill.

## Data model highlights

- Money columns are `INTEGER` minor units: `target_amount`, `raised_amount`, `paid_amount`, `amount`, `fee`.
- `payments` carries three unique constraints that do the heavy lifting: `(payer_id, client_idempotency_key)` for client idempotency, `(payment_provider, provider_payment_id)` for provider idempotency, and `help_records.payment_id` for one-help-per-payment.
- `receipts.sha256` is unique, which is how duplicate receipt submission is detected across the whole platform.
- `audit_logs` is append-only (no update/delete path exists in the service layer).
- `rate_limits` and `email_outbox` keep infrastructure concerns out of third-party services.

## Frontend structure

- `src/components/ui/` — primitives: `Button`, `Avatar`, `Toast`, `ProgressBar`, `Pill`, `Skeleton`, `EmptyState`.
- `src/components/bill/BillCard.tsx` — the swipe surface: `useMotionValue` for x/y, `AnimatePresence` for the stack, stamps driven by motion transforms.
- `src/components/payment/HelpSheet.tsx` — two-step amount → confirm flow, owns the idempotency key so retries reuse it.
- `src/pages/` — one file per route, lazy-loaded via `React.lazy` in `App.tsx`.
- `src/lib/api.ts` — typed fetch wrapper that normalises errors into `ApiRequestError` with field-level messages.
- Illustrations (`ReceiptArt`) are deterministic SVG generated from the bill id — no third-party images, no fake photography of real people.

## Internationalisation

- `src/lib/i18n.tsx` holds the dictionary (**English source string → Chinese**) plus an `I18nProvider` and a `useI18n()` hook exposing `t`, `tp` (plural), `money`, `date`, `timeAgo` and `num`.
- Keys are the English copy itself (gettext-style msgids) so components stay readable and a missing entry degrades to English rather than showing a key.
- Lookups run through a normalised index that ignores curly vs straight quotes and en/em dashes — the copy uses typographic characters, the dictionary is written plainly, and they still match.
- `language` lives in `localStorage` for instant start-up, defaults to `navigator.language`, and is mirrored to `users.locale` with a fire-and-forget `PATCH /api/me` so it can follow the account.
- `document.documentElement.lang` is kept in sync (screen readers, hyphenation, CJK font fallback).
- **Server copy stays language-agnostic**: notification titles and community headlines are generated in English, and the client recomposes them from structured fields (`src/lib/communityCopy.ts`). Bill text written by members is never machine-translated.
- Demo fixtures are bilingual by construction (`src/lib/demoContent.ts`), keyed by their English title.
- `scripts/audit-i18n.mjs` crawls every route in Chinese and fails if any English remains — currently 0.
- Layout was re-verified in Chinese: CJK glyphs are wider, which surfaced a 2 px header overflow at 320 px that was fixed by collapsing the switcher label below 360 px.

## Performance notes

- Route-level code splitting keeps the initial bundle small (main chunk ≈ 96 kB gzipped).
- Hashed assets get `immutable` caching; HTML stays revalidated.
- Lists are capped server-side (Discover 30, admin 100) to keep payloads predictable.
- Reduced-motion users get the same flows without transitions (`useReducedMotion`).
