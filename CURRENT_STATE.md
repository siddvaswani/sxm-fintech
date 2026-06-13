# CURRENT_STATE — Sxm Fintech

> What's built, what's not, what's in progress, known issues. Update at the end of every session.

_Last updated: 2026-06-13 (desktop session — handoff to laptop)_

## Phase

**Phase 1 — plan approved, ready to build.** No app code yet. The full design is locked and committed.

## What this project is now (scope defined this session)

A **proof of concept for a grant application**: a cross-border B2B payment over **Open Payments** on the Interledger **test** wallet (test money only). Business A → Business B, **cross-currency**, showing the **fee + exchange rate before the user confirms**. Platform **never custodies funds** — it only initiates/routes; the test wallets settle.

## Decisions locked

- **Stack:** Next.js (App Router) + TypeScript. SDK: `@interledger/open-payments` (7.x).
- **Currency:** target **USD → XCG (Caribbean Guilder)**, but app is **currency-agnostic** (reads asset code/scale dynamically) because XCG availability on the test wallet is **unconfirmed**. Falls back to EUR/MXN with zero code change.
- **Custody:** no ledger/balance/funds module anywhere; `lib/payments/` is the only OP-touching layer; private key server-side only.
- **Build style:** one branch per part, merged to `main` with a plain-English summary each time.
- **Credentials:** user will create the test wallets + key later and plug them in (`.env`). No live run possible until then.

## Built so far

- ✅ Repo + Phase 0 docs (CLAUDE.md, ARCHITECTURE.md, CURRENT_STATE.md, .gitignore)
- ✅ Pushed to GitHub: `github.com/siddvaswani/sxm-fintech` (private, `main`)
- ✅ **Approved design spec:** `docs/specs/2026-06-13-cross-border-payment-poc-design.md` — contains the **verified Open Payments flow with exact SDK calls** (pulled from official `interledger/open-payments` Node snippets, not memory). This is the build bible.
- ✅ Business folder exists: `~/Documents/Projects/Sxm Fintech/`

## NOT built yet

- ❌ The Next.js app (no `feat/01-app-scaffold` branch yet)
- ❌ Any of the 6 build parts (see spec §8)
- ❌ `.env.example`, `SETUP.md`
- ❌ Test-wallet accounts + developer key (user creates these)

## ▶️ Pick up here on the laptop (next actions, in order)

1. **Pull latest `main`** (`git pull`) — the spec + docs are there.
2. **Re-fetch live docs** (`openpayments.dev` + `github.com/interledger/open-payments/snippets/node`) to confirm nothing changed since 2026-06-13, then trust the snippets captured in the spec.
3. Read `docs/specs/2026-06-13-cross-border-payment-poc-design.md` end-to-end — it has every API call.
4. Start **`feat/01-app-scaffold`**: scaffold Next.js + TS, add `.env.example`, write `lib/payments/client.ts` (the authenticated client), add the Custody Model note to ARCHITECTURE.md.
5. Proceed through parts 2→6 (spec §8), branch per part, merge to main, update this file after each.
6. Resolve the two open setup choices (spec §11): XCG-vs-fallback, and 2-wallet vs 3-wallet setup.

## Known issues / risks

- **XCG may not exist on the test wallet** — mitigated by currency-agnostic design; confirm at wallet-creation time.
- **No end-to-end verification yet** — first real run requires the user's credentials (`SETUP.md` will guide it).
- Interactive consent step redirects the browser to the test wallet and back via `/callback` — expected, not a bug.
