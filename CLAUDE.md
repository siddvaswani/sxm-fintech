# CLAUDE.md — Sxm Fintech

> Instructions for Claude Code working in this repo. Read this at the start of every session and keep it current.

## What this is

**Sxm Fintech** (placeholder name) is a **proof of concept for a grant application**: a cross-border
B2B payment over **Open Payments** on the Interledger **test** wallet (test money only). Business A →
Business B, cross-currency, showing the **fee + exchange rate before the user confirms**. The platform
**never custodies funds** — it only initiates/routes; the test wallets settle.

> 📖 **Read first:** `docs/specs/2026-06-13-cross-border-payment-poc-design.md` — the approved design,
> with the **verified Open Payments flow and exact SDK calls** (from official snippets). Then
> `CURRENT_STATE.md` for "pick up here." Re-fetch live docs (openpayments.dev) before building to
> confirm nothing changed.

## Owner

- Sidd — **non-technical solo founder**. Explain things in plain language; walk through what was built and why (teaching mode), not just status.
- Keep messages short and simple, then iterate.

## Stack

- **Next.js (App Router) + TypeScript.**
- **`@interledger/open-payments`** (Node SDK, 7.x) — the official Open Payments client.
- Test wallet: `wallet.interledger-test.dev`. No database; the one bit of state (grant continuation
  across the consent redirect) is server-side only.
- Explain TypeScript idioms inline as you write — Sidd comes from Python.

## Conventions

- Three living docs at repo root, kept current throughout development:
  - **CLAUDE.md** — this file (stack, conventions, do/avoid, scripts)
  - **ARCHITECTURE.md** — system design, data model, component map
  - **CURRENT_STATE.md** — what's built, what's not, in progress, known issues
- Repo name = local folder name, lowercase-kebab-case: `sxm-fintech`.
- Don't commit `.claude/` or `.superpowers/` (tool-local config — gitignored).
- Git identity: Siddhant Vaswani <siddvaswani@wysper.co>.

## Scripts

- TBD — set during `feat/01-app-scaffold` (expect `npm run dev`, `npm run build`, `npx tsc --noEmit`).

## Build conventions for this POC

- **One branch per build part**, merged to `main` with a plain-English summary (see spec §8). Sidd
  wants to understand each part independently.
- Keep `lib/payments/` the ONLY layer touching Open Payments. **No ledger/balance/funds module** —
  ever. Private key stays server-side.
- Stay **currency-agnostic** (read asset code/scale dynamically). Target USD→XCG, fallback EUR/MXN.
- Update `CURRENT_STATE.md` after each part.

## Related

- Business folder (iCloud, non-code assets): `~/Documents/Projects/Sxm Fintech/`
- GitHub: `github.com/siddvaswani/sxm-fintech` (private)
