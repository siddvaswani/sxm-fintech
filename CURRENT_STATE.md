# CURRENT_STATE — Sxm Fintech

> What's built, what's not, what's in progress, known issues. Update at the end of every session.

_Last updated: 2026-06-16 — Part 6 (UI wire-up) complete; all 6 build parts done._

## Phase

**Phase 2 — build complete.** All 6 of 6 parts done. App type-checks, builds, and renders clean.
Only `SETUP.md` + the user's first live run remain.

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

## NOT built yet

- ❌ `SETUP.md` (wallet + key walkthrough) — the only remaining task
- ❌ Test-wallet accounts + developer key (user creates these; no live run until then)

## ▶️ Pick up here (next action)

**All 6 build parts are done.** What's left is non-code-by-Claude: write **`SETUP.md`** — a
screenshot-level walkthrough to create, at `wallet.interledger-test.dev`: (1) a key pair (→ `KEY_ID`
+ `private.key` → `PRIVATE_KEY_PATH`), (2) the platform/client wallet (`CLIENT_WALLET_ADDRESS`),
(3) Business A = USD (`SENDER_WALLET_ADDRESS`), (4) Business B = XCG if offered else EUR/MXN
(`RECEIVER_WALLET_ADDRESS`) — confirm XCG availability here (spec §11). Then Sidd fills `.env`, runs
`npm run dev`, and does the **first live end-to-end run** (the only thing never verified yet). Note
the 2-wallet vs 3-wallet choice (spec §7) — default to simpler 2-wallet (client = sender) if short
on time.

_Resuming on another Mac:_ ALWAYS `git fetch --all` + `git pull --ff-only` on `main` FIRST (this
repo is edited from two Macs and the local copy silently drifts), run `npm install`, then continue
with `SETUP.md` (no new branch needed — or use `docs/SETUP.md`). Parts 1–6 are on `main` as of 2026-06-16. No live run
yet — that needs the two test wallets + dev key in `.env` (`SETUP.md`, built last).

## Known issues / risks

- **XCG may not exist on the test wallet** — mitigated by currency-agnostic design; confirm at setup.
- **No end-to-end verification yet** — first real run needs the user's credentials (`SETUP.md` later).
- Interactive consent step (Part 4) redirects the browser to the test wallet and back — expected.
- `npm audit` reports a couple of moderate advisories from the Next toolchain — noted, not addressed
  in this POC (test-only, no production concern).
