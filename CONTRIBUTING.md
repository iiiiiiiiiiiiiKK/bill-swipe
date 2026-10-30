# Contributing to BILL SWIPE

Thanks for wanting to help. A few ground rules keep this project honest.

## The honesty rule

This product deals with people who are having a bad week. That makes two things non-negotiable:

1. **No fabricated data.** Never hardcode statistics, testimonials or "success" states. If a number is shown, it comes from the database. Demo records must be flagged (`is_demo`) and labelled in the UI.
2. **No fake success.** The frontend must reflect what the server actually returned. A payment is only ever "succeeded" after the server says so.

## Getting set up

```bash
npm install
cp .env.example .dev.vars   # optional
npm run dev:api             # terminal 1
npm run dev                 # terminal 2
```

## Before you open a pull request

```bash
npm run typecheck
npm test
E2E_BASE_URL=<your deployment> npm run test:e2e
node scripts/audit-ui.mjs <your deployment>
```

All four should pass. If a check is genuinely not applicable, say why in the PR description.

## Code conventions

- **Money is always integer minor units.** Never introduce a float into `src/shared/money.ts`, the payment service, or the schema. Format at the edge only.
- **Authorisation belongs on the server.** The UI may hide a button; the API must still refuse the request.
- **Validate with Zod in `src/worker/api.ts`**, then enforce business rules in `src/worker/core/service.ts`.
- **Atomic writes go through `db.transaction()`.** Anything that touches `bills.raised_amount` must also update payments/help records in the same transaction.
- **New tables**: add them to `src/worker/db/schema.ts` and bump `SCHEMA_VERSION`. Migrations must be additive and idempotent (`CREATE TABLE IF NOT EXISTS`).
- **Tailwind classes are grouped** layout → spacing → typography → colour → state. Use the tokens in `src/index.css` (`bg-canvas`, `text-muted`, `rounded-[22px]`, …) instead of inventing new hex values where a token exists.
- **Accessibility is not optional**: 32 px minimum tap targets, AA contrast, `aria-label` on icon-only buttons, keyboard reachable controls.

## Design contributions

Screenshots of before/after win arguments. Keep the visual language: warm off-white canvas, electric purple primary, coral accents, generous whitespace, restrained gradients, no template-SaaS look.

## Reporting bugs

Include the URL or route, viewport size, what you expected, what happened, and any console errors. For anything security-related, follow [`SECURITY.md`](SECURITY.md) instead of opening a public issue.
