# CURRENT_STATE — Sxm Fintech

> What's built, what's not, what's in progress, known issues. Update at the end of every session.

_Last updated: 2026-06-17 — ✅ FIRST LIVE END-TO-END RUN SUCCEEDED. Real USD→EUR payment settled on both wallets._

## Phase

**Phase 3 — VERIFIED LIVE. 🎉** All 6 build parts done AND proven with a real run on the Interledger
test wallet (2026-06-17): Business A (USD) paid Business B (EUR), quote→approve→send→settle, money
moved on both accounts. Test sent: B receives €10.00 → A pays $11.54 (rate 1 USD = 0.866551 EUR;
cross-currency fee shown as 0.00 by design — cost is in the rate). The platform held no funds.
**One real fix was needed to run live** (see Known issues). Remaining work is non-code: grant demo
capture + writeup (grant app v1 already drafted by Sidd). `SETUP.md` is now OPTIONAL (Sidd did the
wallet setup live with Claude instead of from a doc).

## What this project is

A **proof of concept for a grant application**: a cross-border B2B payment over **Open Payments** on
the Interledger **test** wallet (test money only). Business A → Business B, cross-currency, showing the
**fee + exchange rate before the user confirms**. Platform **never custodies funds** — it only
initiates/routes; the test wallets settle.

## Decisions locked

- **Stack:** Next.js 16 (App Router, Turbopack) + React 19 + TypeScript + Tailwind 4. SDK
  `@interledger/open-payments` 7.4.0. Node 22.
- **Currency:** target USD → XCG; app is currency-agnostic (reads asset code/scale dynamically),
  falls back to EUR/MXN if XCG isn't offered by the test wallet.
- **Custody:** no ledger/balance/funds module anywhere; `lib/payments/` is the only OP-touching layer;
  private key server-side only (enforced with `server-only`).
- **Build style:** one branch per part, merged to `main` (`--no-ff`) with a plain-English summary.

## Built so far

- ✅ Repo + Phase 0 docs, pushed to `github.com/siddvaswani/sxm-fintech` (private, `main`)
- ✅ **Approved design spec:** `docs/specs/2026-06-13-cross-border-payment-poc-design.md` (verified OP flow + exact SDK calls)
- ✅ **Part 1 — `feat/01-app-scaffold`:** Next.js app merged into repo; `@interledger/open-payments`
  + `dotenv` + `server-only` installed; **`lib/payments/client.ts`** (the single authenticated
  Open Payments client, with teaching comments); **`.env.example`**; `.gitignore` hardened
  (`.env`, `*.key`). `npx tsc --noEmit` ✅ and `npm run build` ✅.
- ✅ **Part 2 — `feat/02-recipient-setup`:** **`lib/payments/amounts.ts`** (pure `toMinorUnits` /
  `fromMinorUnits`, string-based money math) and **`lib/payments/incoming.ts`**
  (`setupIncomingPayment` → resolves receiver wallet, requests a non-interactive incoming-payment
  grant via `isFinalizedGrantWithAccessToken`, creates the incoming payment with the receiver's
  *dynamic* currency, returns the incoming payment `id`). Currency-agnostic. tsc ✅, build ✅.
  Demo model = **invoice-style / fixed receive amount**: B's incoming payment fixes how much B
  receives in B's currency; Part 3's quote derives what A must pay (incl. FX + fee).
- ✅ **Part 3 — `feat/03-quote-and-fx`:** **`lib/payments/quote.ts`** (`createQuote` → resolves the
  SENDER's wallet, requests a non-interactive **quote** grant via `isFinalizedGrantWithAccessToken`,
  then `client.quote.create({ method: 'ilp', walletAddress: senderId, receiver: incomingPaymentId })`).
  Returns a clean `QuoteResult`: both **`debitAmount`** (what A pays, sender currency) and
  **`receiveAmount`** (what B gets, receiver currency) as `{ value, assetCode, assetScale }`, the
  **`quote.id`**, plus a derived `display` summary (human debit/receive via `fromMinorUnits`,
  **exchange rate**, and **fee**). Fee is exact (debit − receive) only when both sides share a
  currency; cross-currency the cost story is the rate (no fee is faked). Currency-agnostic —
  asset code/scale read live. Re-verified against the live OP `grant-quote` + `quote-create`
  snippets: signatures unchanged. tsc ✅, build ✅.
- ✅ **Part 4 — `feat/04-consent-redirect`:** **`lib/payments/outgoing-grant.ts`** —
  `requestOutgoingGrant` (resolves the sender wallet, requests the **INTERACTIVE**
  outgoing-payment grant with `interact.start: ['redirect']` + `finish.{method,uri,nonce}` and a
  spend `limits.debitAmount`, guards with `isPendingGrant`, returns the browser `redirectUrl` +
  the `continue` token/uri + nonce to stash) and `continueOutgoingGrant` (extracts `interact_ref`
  from the returned url, calls `grant.continue`, guards with `isFinalizedGrantWithAccessToken`,
  returns the finalized access token for Part 5; carries a hardening TODO to verify the returned
  `hash`). The `debitAmount` is **passed in as a typed param** — NOT imported from Part 3's
  `quote.ts` — so the two parts stay decoupled. **`lib/payments/redirect-state.ts`** — a minimal
  in-memory, nonce-keyed server-side stash for the cross-redirect state (`continue.*`, nonce,
  quote id, sender wallet); the app's only persistence, POC-only. **`app/callback/route.ts`** —
  App Router GET handler the test wallet redirects back to; parses `interact_ref`, looks up the
  stashed state by nonce, and (when present) finishes the grant. Callback base configurable via
  `APP_BASE_URL`, defaulting to `http://localhost:3000`. Live SDK re-verified against the
  official `snippets/node/grant` (`grant.ts` + `grant-continuation.ts`) — matches the spec
  exactly. tsc ✅, build ✅.
- ✅ **Part 5 — `feat/05-send-payment`:** **`lib/payments/outgoing.ts`** (`createOutgoingPayment` →
  resolves the SENDER's wallet, then calls `client.outgoingPayment.create({ url:
  sender.resourceServer, accessToken }, { walletAddress: sender.id, quoteId })` using the
  **finalized token from Part 4** + the **quote id from Part 3** — money moves here). Binds the
  payment to the **quote id** (not raw amounts) so the charge can't differ from the confirm
  screen; single beat (no grant request — Part 4 already got the token). Returns a clean
  `PaymentReceipt`: outgoing payment **`id`**, `failed` flag, `receiver`, `createdAt`, and all
  three amounts (`debitAmount` / `receiveAmount` / **`sentAmount`**) as `{ value, assetCode,
  assetScale }`, plus a `display` block (human debit/receive/sent via `fromMinorUnits` +
  "Sent"/"Failed" status). Currency-agnostic. **`app/callback/route.ts`** extended: after the
  grant finalizes, if the stash has `quoteId` + `senderWalletUrl` it sends for real and returns
  the receipt (`stage: 'payment-created'`); otherwise it stops at `grant-finalized` as before
  (full nonce plumbing lands in Part 6). Re-verified against the live OP
  `create-outgoing-payment` snippet — signature unchanged. tsc ✅, build ✅.
- ✅ **Part 6 — `feat/06-ui-wire-up`:** the **3 screens** + the 2 API routes that tie the lib
  layer together, plus the callback nonce plumbing. **`app/page.tsx`** (client) = Start + Review
  in one component (quote held in React state): Start enters the amount B receives →
  `POST /api/quote`; Review shows debit/receive + rate + fee → `POST /api/send`. **`app/api/quote/
  route.ts`** runs Part 2 (`setupIncomingPayment`) → Part 3 (`createQuote`), returns `QuoteResult`.
  **`app/api/send/route.ts`** runs Part 4 (`requestOutgoingGrant`), stashes `quoteId` +
  `senderWalletUrl` via `saveRedirectState`, returns the wallet `redirectUrl` (browser navigates
  there to approve). **`app/result/page.tsx`** (server) = the receipt; `/callback` now redirects
  here with the receipt as **base64url JSON in `?r=`** (stateless, refresh-safe — no new store).
  **Nonce plumbing:** `outgoing-grant.ts` `callbackUri(nonce)` now puts `?nonce=` on the
  `finish.uri`, so the wallet returns it on the callback URL and the stash lookup works. Routes
  read `SENDER`/`RECEIVER` wallet addresses from env; errors surface as readable messages.
  `layout.tsx` title fixed. Smoke-tested on dev server: Start renders, Result renders (with + without
  a receipt). The app's only server state is still the one nonce-keyed redirect stash. tsc ✅, build
  ✅ (routes: `/`, `/api/quote`, `/api/send`, `/callback`, `/result`).

## NOT built yet (code)

- Nothing required. The app is built AND verified live. `SETUP.md` is now OPTIONAL (wallet setup was
  done live, not from a doc) — write it only if the grant submission wants a reproducible walkthrough.

## Live setup actually used (2026-06-17)

- **2-wallet setup** (spec §7 default): the platform/client IS Business A (its key signs).
- Wallets on `wallet.interledger-test.dev` (one login, two accounts):
  `SENDER`/`CLIENT` = `https://ilp.interledger-test.dev/business-a` (USD),
  `RECEIVER` = `https://ilp.interledger-test.dev/business-b` (EUR — **XCG NOT offered** by the test
  wallet, EUR fallback; currency-agnostic design meant zero code change).
- Credentials live in `.env` (gitignored) + `private.key` PEM file at repo root (gitignored). Dev key
  generated on `business-a`. Business A funded with test USD (note: the wallet charges a simulated
  deposit fee — unrelated to the app).
- **Verified behaviors (not bugs):** cross-currency **fee displays 0.00** (cost is in the rate, by
  design — no faked fee); **"settled so far" reads 0.00** on the receipt because `sentAmount` is read
  the instant the outgoing payment is created (settlement is async — confirmed both balances moved
  after).

## ▶️ Pick up here (next action)

**Code phase is DONE and proven.** Next is grant work (Sidd's, non-code): capture a demo
recording/screenshots of the working USD→EUR flow, and finish the grant writeup (app v1 drafted).
**Deadline: 2026-06-30** (Open Payments Accelerator). Optional code polish if time: the `hash`
verification TODO in `app/callback/route.ts`; a dedicated 3rd "platform" wallet for the cleaner
no-custody story (spec §7, 3-wallet).

_Resuming on another Mac:_ ALWAYS `git fetch --all` + `git pull --ff-only` on `main` FIRST (two-Mac
repo, local drifts), run `npm install`. **Note: `.env` + `private.key` are gitignored and do NOT sync
via GitHub** — the other Mac needs its own `.env` + a private key (either re-copy the files out of
band, or generate a fresh dev key on `business-a` in the test wallet). Parts 1–6 + the live-run fix
are on `main` as of 2026-06-17.

## Known issues / risks

- **`next.config.ts` must keep `serverExternalPackages: ['@interledger/open-payments']`** — without it
  the SDK's runtime YAML spec reads break under Turbopack bundling (`ENOENT /ROOT/.../*.yaml`). This
  was THE fix that made the live run work. Don't remove it.
- A brief "internal server error" can flash on the **test wallet's** side during the approval→callback
  redirect; our app logs were clean (quote 200, send 200, callback 307, result 200). Cosmetic/upstream.
- **XCG not on the test wallet** — using EUR; currency-agnostic design absorbed it with no code change.
- `.env`/`private.key` are machine-local (gitignored) — not synced across the two Macs.
- `npm audit` reports a couple of moderate advisories from the Next toolchain — noted, not addressed
  in this POC (test-only, no production concern).
