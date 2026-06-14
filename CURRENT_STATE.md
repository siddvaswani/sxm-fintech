# CURRENT_STATE — Sxm Fintech

> What's built, what's not, what's in progress, known issues. Update at the end of every session.

_Last updated: 2026-06-14 — Part 3 (quote + FX) complete._

## Phase

**Phase 2 — building, part by part.** Parts 1–3 of 6 done. App type-checks and builds clean.

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

## NOT built yet

- ❌ Part 4 `feat/04-consent-redirect` — interactive grant + `/callback` + `grant.continue`
- ❌ Part 5 `feat/05-send-payment` — outgoing payment create + receipt
- ❌ Part 6 `feat/06-ui-wire-up` — the 3 clickable screens incl. the confirm-before-send step
- ❌ `SETUP.md` (wallet + key walkthrough)
- ❌ Test-wallet accounts + developer key (user creates these; no live run until then)

## ▶️ Pick up here (next action)

Start **Part 4 — `feat/04-consent-redirect`**: this is the INTERACTIVE step. In a new module
(e.g. `lib/payments/authorize.ts`), request an **outgoing-payment** grant on the SENDER's auth
server with `interact: { start: ['redirect'], finish: { method: 'redirect', uri:
'http://localhost:3000/callback', nonce } }` and `limits.debitAmount` set from the Part 3 quote's
`debitAmount`. Guard with `isPendingGrant`. Add an `app/callback` route that reads
`interact_ref` from the return URL and calls `client.grant.continue(...)`, guarded by
`isFinalizedGrantWithAccessToken`. Carry `quote.id` + `grant.continue.*` + sender wallet across the
redirect **server-side only** (signed cookie or in-memory keyed by nonce — never the browser).
Exact verified calls in the spec (§5, Step 3 + 3b).

## Known issues / risks

- **XCG may not exist on the test wallet** — mitigated by currency-agnostic design; confirm at setup.
- **No end-to-end verification yet** — first real run needs the user's credentials (`SETUP.md` later).
- Interactive consent step (Part 4) redirects the browser to the test wallet and back — expected.
- `npm audit` reports a couple of moderate advisories from the Next toolchain — noted, not addressed
  in this POC (test-only, no production concern).
