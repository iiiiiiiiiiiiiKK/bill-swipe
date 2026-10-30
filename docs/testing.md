# Test report

Recorded against the live deployment `https://billswipe.852367856.dpdns.org` and the local test runner. Everything below was executed, not estimated.

## Summary

| Suite | Command | Result |
| --- | --- | --- |
| TypeScript (strict) | `npm run typecheck` | **0 errors** |
| Unit + integration | `npm test` | **46 / 46 passed** |
| API contract (black box) | `node scripts/smoke.mjs <url>` | **31 / 31 passed** |
| End-to-end journeys | `npm run test:e2e` | **29 passed, 1 skipped** (desktop Chrome + iPhone 13 / WebKit) |
| Responsive / a11y / contrast (EN) | `node scripts/audit-ui.mjs <url> en` | **337 / 337 passed** across 8 viewports |
| Responsive / a11y / contrast (中文) | `node scripts/audit-ui.mjs <url> zh` | **337 / 337 passed** across 8 viewports |
| Translation coverage | `node scripts/audit-i18n.mjs <url>` | **0 untranslated strings** across 13 routes |
| Production build | `npm run build` | Success (main chunk ≈ 96 kB gzip) |

## Unit and integration tests — 46 passing

Real SQLite (Node's built-in `node:sqlite`) driving the **production** schema and service layer through a thin adapter, so these are not stubs: the SQL, transactions and constraints are the ones that run in production.

```
tests/money.test.ts     10 tests
tests/service.test.ts   28 tests
tests/i18n.test.ts       8 tests
```

**Money** — formatting, minor-unit parsing, split display, `0.10 × 10 === 100` (no float drift), progress clamping, basis-point fees with rounding.

**Accounts** — registration hashes with PBKDF2 (never stores the password), rejects duplicate email/username, rejects weak passwords and reserved usernames, login only accepts the correct password, banned accounts cannot sign in.

**Bills** — creation lands in `pending_review` with integer amounts, amount range and story length are enforced, pending bills stay out of Discover until approved, owners are excluded from their own feed, bills lock once help arrives, users cannot edit or close someone else's bill.

**Swipes** — recorded, hidden from the feed, undoable (restores card *and* deletes the row), self-swipe refused.

**Payments** — pending intent → single settlement; replay returns `alreadySettled` with no double increment; client idempotency key reuse returns the same payment; contribution capped at the outstanding balance; fully-funded transition refuses further intents; refund reverses the total and writes an audit entry; failed payments never touch the bill; anonymous helpers hidden from the public but visible to the owner; notifications and feed posts written in the same transaction.

**Community & moderation** — statistics derived from real records, duplicate open reports rejected, admin overview/payment/user queries, audit records for every review action, self-ban refused.

**Internationalisation** — no empty translations, placeholder parity between English and Chinese, every entry actually translated, and lookups that survive typographic differences (curly quotes, en/em dashes). This suite caught a real bug: a scripted edit had stripped the backslash from `\s+`, so `normaliseKey` was deleting the letter "s" from every key.

**Concurrency** — three helpers race to fund a bill; the final `raised_amount` equals `target_amount` exactly and the bill ends `fully_funded`, never over-funded.

## API contract tests — 31 passing

Black-box HTTP walk against the deployment, exercising the real cookie session and the real rate limiter:

```
ok health · ok discover (guest) · ok me(guest)→401 · ok register · ok me(session)
ok duplicate email rejected · ok discover (auth) · ok bill detail · ok swipe pass · ok undo swipe
ok create payment intent · ok idempotent intent reuse · ok sandbox settle · ok settle replay is idempotent
ok raised amount updated once (18000 → 19000) · ok my payments · ok notifications · ok community feed
ok admin blocked for normal user · ok cannot edit someone else's bill
ok create bill · ok my bills · ok pending bill not in discover
ok admin login · ok admin overview · ok admin pending queue · ok admin approve · ok approved bill visible
ok audit log written · ok admin refund · ok refund decrements raised (2000 → 1000)
```

## End-to-end journeys — 29 passed, 1 skipped

Playwright, running against the live URL in two projects (desktop Chrome 1440×900 and iPhone 13 / WebKit).

| Journey | Assertions |
| --- | --- |
| Landing | hero headline, both CTAs, footer identity |
| X author link | every header X link points at `https://x.com/0xkillcoin` |
| Discover | cards render, action bar usable, verification/demo labels present |
| Static pages | `/how-it-works`, `/trust`, `/payments-info`, `/faq`, `/about` all render |
| Sandbox disclosure | `/payments-info` states sandbox mode |
| **Help flow** | register → pass → help → `$10` → continue → confirm screen (fee + total + sandbox notice) → confirm → success state → close |
| Keyboard | `←` advances the deck (desktop only; skipped on mobile) |
| **Language switcher** | switch to Chinese → nav/hero/footer flip, `html[lang]=zh-CN`, survives reload, Discover renders in Chinese, switch back to English |
| **Post a bill** | five-step wizard → submit → redirect to the bill → status "In review" |
| Validation | wizard blocks progress without a 60-character story |
| Admin | login → dashboard counters → review queue with Approve controls → audit tab |
| Authorisation | normal user is redirected away from `/admin` |
| Duplicate account | second registration surfaces "already registered" |
| Private routes | `/bills` redirects anonymous visitors to `/login` |
| 404 | friendly not-found page with a working route back |

## Responsive, accessibility and contrast audit — 337 checks

Eight viewports — iPhone SE (320), iPhone 8 (375), iPhone 14 (390), iPhone Pro Max (430), iPad (768), laptop (1280), desktop (1440), wide (1920) — across nine routes.

Per page and viewport the audit asserts:

- the app renders content (no blank SPA root),
- **zero horizontal overflow** (`scrollWidth <= clientWidth`),
- **nothing positioned off-screen to the right**,
- on mobile, every interactive element is **≥ 32 px** tall,
- **no interface text below 10 px**,
- plus WCAG AA contrast for every text node and basic a11y hygiene (image alt text, accessible button names, a single `h1`).

Findings fixed during development, all re-verified:

| Finding | Fix |
| --- | --- |
| Bottom nav overflowed by 12 px at 320 px | Flex items with `min-w-0` instead of fixed 64 px |
| Footer/nav links were 16–28 px tall tap targets | `min-h-[32px]` on link items |
| Password reveal button was 24 × 24 | 32 × 32 with a larger icon |
| Category chips and wordmark under 4.5:1 | Darker category ink palette, `brand-ink` for the wordmark |
| Muted body text at 3.5:1 | Token darkened to `#6E6B78`; tertiary labels to `#736E66` |
| Avatar initials 1:1 on light gradients | Darkened the generated avatar palette |

## Translation coverage

`scripts/audit-i18n.mjs` loads thirteen routes with Chinese active, walks every visible text node, filters out intentionally Latin strings (brand, currency, status enums, generated receipt digits) and fails on anything still English. The current build reports **0** untranslated strings.

Two categories are translated by design rather than by lookup:

- **Demo fixtures** (16 bills, helper names, sample comments) ship in both languages in `src/lib/demoContent.ts` and the dictionary.
- **Server-generated copy** (notifications, community headlines) is stored in English and recomposed client-side from structured fields, so the database stays language-agnostic.

## What is *not* covered

Being explicit, because a green suite is easy to over-read:

- **No real payment provider** is exercised — settlement is sandbox-only by design. A Stripe/webhook path would need its own contract tests before launch.
- **No load or soak testing.** The single Durable Object serializes writes; throughput has not been characterised.
- **No third-party penetration test.** Server-side authorisation and input handling are covered by tests and review, not by an audit.
- **No real email delivery** — the outbox is inspected, not a live inbox.
- **Image upload** is validated (type, size, magic bytes, SHA-256 dedupe) and stored, but the visual redaction of sensitive content is the uploader's responsibility and is untested because it is manual.
- **WebKit TLS**: the iPhone project runs with `ignoreHTTPSErrors` because the sandbox's certificate chain is rejected by WebKit; that is a test-harness accommodation, not an app setting.

## Reproducing

```bash
npm install
npm run typecheck
npm test

export E2E_BASE_URL=https://your-deployment
npm run test:e2e

node scripts/smoke.mjs https://your-deployment
node scripts/audit-ui.mjs https://your-deployment
```

`wrangler tail billswipe` while running the smoke test shows the server-side request log; nothing in the suite depends on hidden test-only endpoints.
