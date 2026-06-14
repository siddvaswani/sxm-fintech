# CURRENT_STATE — Sxm Fintech

> What's built, what's not, what's in progress, known issues. Update at the end of every session.

_Last updated: 2026-06-14 — Part 1 (app scaffold) complete._

## Phase

**Phase 2 — building, part by part.** Part 1 of 6 done. App scaffolds, type-checks, and builds clean.

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

## NOT built yet

- ❌ Part 2 `feat/02-recipient-setup` — incoming-payment grant + create (Business B)
- ❌ Part 3 `feat/03-quote-and-fx` — quote grant + create; expose fee/rate/amounts
- ❌ Part 4 `feat/04-consent-redirect` — interactive grant + `/callback` + `grant.continue`
- ❌ Part 5 `feat/05-send-payment` — outgoing payment create + receipt
- ❌ Part 6 `feat/06-ui-wire-up` — the 3 clickable screens incl. the confirm-before-send step
- ❌ `SETUP.md` (wallet + key walkthrough)
- ❌ Test-wallet accounts + developer key (user creates these; no live run until then)

## ▶️ Pick up here (next action)

Start **Part 2 — `feat/02-recipient-setup`**: in `lib/payments/incoming.ts`, request an
incoming-payment grant on the RECEIVER's auth server, then `incomingPayment.create` on its resource
server. Exact verified calls are in the spec (§5, Step 1). Returns the incoming payment `id` that
Part 3's quote will point at.

## Known issues / risks

- **XCG may not exist on the test wallet** — mitigated by currency-agnostic design; confirm at setup.
- **No end-to-end verification yet** — first real run needs the user's credentials (`SETUP.md` later).
- Interactive consent step (Part 4) redirects the browser to the test wallet and back — expected.
- `npm audit` reports a couple of moderate advisories from the Next toolchain — noted, not addressed
  in this POC (test-only, no production concern).
