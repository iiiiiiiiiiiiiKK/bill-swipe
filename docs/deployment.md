# Deployment guide

Everything here can be done from a terminal with a Cloudflare account. The reference deployment runs at <https://billswipe.852367856.dpdns.org>, on the Workers Free plan.

## 1. Prerequisites

- Node.js 20+ (developed on Node 24)
- A Cloudflare account
- `wrangler` (installed as a dev dependency — use `npx wrangler`)

```bash
npm install
npx wrangler login          # or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
```

## 2. Create the private receipt bucket

```bash
npx wrangler r2 bucket create billswipe-receipts
```

`wrangler.toml` already binds it as `RECEIPTS`. Receipts are stored under `private/<userId>/<sha256-prefix>` and are only readable through the authenticated admin route.

## 3. Configure secrets

```bash
# Required: signs the Worker→Durable Object channel and salts IP hashes
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx wrangler secret put SESSION_SECRET

# Strongly recommended: replace the seeded bootstrap admin
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
```

Optional (leave unset for the sandbox build):

| Secret | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Real provider credentials (requires the webhook route to be implemented) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `RESEND_API_KEY` | Actually send the emails that are otherwise queued in `email_outbox` |

## 4. Point the config at your domain

Edit the `[vars]` block and the `routes` entry in `wrangler.toml`:

```toml
[vars]
ENVIRONMENT = "production"
PAYMENT_MODE = "sandbox"
APP_ORIGIN = "https://your-domain.example"
PLATFORM_FEE_BPS = "0"
ALLOW_DEMO_SEED = "true"

routes = [
  { pattern = "your-domain.example", custom_domain = true }
]
```

The domain must be an active zone in the same Cloudflare account. Without a route, the Worker is still reachable at `<worker>.<subdomain>.workers.dev` — but note that some networks (including parts of mainland China) cannot resolve `*.workers.dev`, so a custom domain is the reliable option.

If you delete and recreate the Worker, the domain binding is dropped — re-attach it with
`node scripts/attach-domain.mjs your-domain.example billswipe`, or directly:

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/domains" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"environment":"production","hostname":"your-domain.example","service":"billswipe","zone_id":"'$ZONE_ID'"}'
```

## 5. Deploy

```bash
npm run deploy       # builds the SPA, then `wrangler deploy`
```

Expected output ends with the Custom Domain and the version id. There is **no database migration step**: the Durable Object creates and versions its schema on first boot, and seeds the demo dataset unless `ALLOW_DEMO_SEED=false`.

## 6. Verify the deployment

```bash
node scripts/smoke.mjs https://your-domain.example    # 31 API checks
node scripts/audit-ui.mjs https://your-domain.example # 337 UI/a11y checks
E2E_BASE_URL=https://your-domain.example npm run test:e2e
node scripts/screenshots.mjs https://your-domain.example docs/screenshots
```

`wrangler tail billswipe` streams live logs; `scripts/smoke.mjs` prints a pass/fail line per contract so a broken deploy is obvious in seconds.

## 7. Operational notes

**Reset the demo dataset.** The Durable Object storage is authoritative. To wipe it:

```bash
npx wrangler deploy --delete-class Core   # destructive: removes the DO and its SQLite data
npm run deploy                            # recreate fresh (schema + seed on first request)
```

**Rotate the admin password.** `ADMIN_PASSWORD` only seeds the *first* admin; changing the secret afterwards does not change an existing hash. Update it through the profile UI, or reset the object as above.

**Free-plan limits to keep in mind**

- Durable Object SQLite storage: 5 GB per object (far beyond this workload).
- Workers requests: 100k/day; DO requests: 1M/month.
- R2: 10 GB storage, 1M Class A ops/month — receipts are small, this is ample.
- One DO serializes writes; that is the throughput ceiling, not the plan limits.

**Costs.** This deployment runs within the free tier. Real traffic, a custom email provider or a payment processor will add cost — nothing here promises unlimited free usage.

## 8. Going live with real payments

1. Choose a provider licensed for your jurisdiction (Stripe Connect, or a local equivalent) and complete its onboarding.
2. Implement `POST /api/webhooks/<provider>`: verify the signature, look up the payment by provider id, call `settlePayment(paymentId, { source: 'webhook' })`.
3. Set `PAYMENT_MODE` accordingly and add the secrets.
4. Add a payout/refund path that mirrors `refundPayment`.
5. Have the flow reviewed against local money-transmission rules before accepting a single real payment. The app never custodies funds itself by design.

## Alternative rail: Binance Pay via a self-hosted gateway

Stripe Connect needs a business entity and provider approval. For an individual operator in a region where that is not available, a self-hosted **Binance Pay gateway** is a plausible alternative — for example [BinancePayTool](https://github.com/qianyubtc/BinancePayTool), which polls a personal account's read-only transactions endpoint and matches orders by a unique amount suffix and a memo code.

**This is not implemented in this repository.** Wiring it in would mean:

1. Running the gateway (single Go binary + SQLite) behind HTTPS, keeping its `API_AUTH_KEY` in a Worker secret.
2. Adding a `binancepay` provider in `src/worker/core/service.ts`: `createPaymentIntent` posts the order to the gateway, stores its `pay_url` as `provider_payment_id`, and the confirmation screen redirects there.
3. Adding `POST /api/webhooks/binancepay` that verifies the gateway's HMAC-SHA256 signature (plus timestamp and nonce for replay protection) and calls `settlePayment(paymentId, { source: 'webhook' })`.
4. Treating the gateway's suffix-adjusted paid amount as authoritative while still recording the nominal help amount against the bill.

Trade-offs worth stating plainly before anyone does this: the gateway relies on a personal Binance account (account-risk and terms-of-service implications), it is read-only so refunds must be sent manually from the Binance app, and crypto rails carry their own compliance obligations. The application-level guarantees — one settlement per payment, atomic totals, audit logging — are unchanged because they live in `settlePayment`, not in the provider.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `wrangler dev` crashes with a workerd stack overflow on Windows | Missing VC++ redistributable. Develop against a deployment (`E2E_BASE_URL=…`) or run WSL. |
| Domain 1016 / DNS error | The `routes` hostname is not an active zone in this account. |
| API returns `core_unavailable:500` | Usually a build mismatch after a schema change. Redeploy, or wipe the DO + redeploy. |
| `Invalid API Token` | Token lacks Workers Scripts / D1 / R2 / Pages permissions, or it is an R2-only token. |
| Login works but `/admin` bounces you out | The account's `role` is `user`. Promote it directly: `UPDATE users SET role='admin'` inside the DO, or seed one via `ADMIN_EMAIL`. |
