# ARCHITECTURE — Sxm Fintech

> High-level system design, data model, and component map. Update as the architecture evolves.

## Status

Design **approved 2026-06-13**, not yet built. Full detail (with verified API calls) lives in
`docs/specs/2026-06-13-cross-border-payment-poc-design.md`. This file is the durable summary.

## What it is

A Next.js + TypeScript proof of concept that initiates **one** cross-currency B2B payment
(Business A → Business B) over **Open Payments** on the Interledger **test** wallet, using the
`@interledger/open-payments` SDK. It shows the **fee + exchange rate before the user confirms**.

## Custody Model (the core architectural principle)

**The platform is a payment _initiator_, never a custodian.** It holds no money, has no balance,
and runs no ledger. The two test wallets (Account Servicing Entities) custody and settle all funds.
Open Payments makes this native: our app is only the GNAP **client** that signs requests and routes
payment instructions.

Enforced structurally:
- `lib/payments/` is the **only** layer that talks to Open Payments. Stateless. No DB, no balances.
- `app/` (UI + thin API routes) calls into `lib/payments/`; it holds no money logic.
- **No ledger / balance / funds-holding module exists anywhere — by design.** Its absence is the proof.
- The **private key is server-side only**; it never reaches the browser.

## Component map

```
app/
  page.tsx                  # Start screen
  review/                   # Review-quote screen (fee + rate shown here → Confirm)
  callback/                 # Return URL after the user approves at the test wallet
  result/                   # Receipt
  api/
    quote/                  # incoming-payment grant + create, then quote grant + create
    send/                   # continue grant + create outgoing payment
lib/
  payments/
    client.ts               # createAuthenticatedClient (the only OP credential holder)
    incoming.ts             # grant + incomingPayment.create (Business B)
    quote.ts                # grant + quote.create (Business A) → debit/receive amounts
    outgoing.ts             # interactive grant + continue + outgoingPayment.create
```
(Exact file split may flex during build; the layering rule above does not.)

## Data flow (the Open Payments sequence)

1. **Recipient setup (B):** incoming-payment grant → `incomingPayment.create` → returns a payment id.
2. **Quote (A):** quote grant → `quote.create(receiver = incomingPayment.id)` → returns
   `debitAmount` (A pays) + `receiveAmount` (B gets). **FX + fee shown here, before confirm.**
3. **Authorize (A):** interactive outgoing-payment grant → browser redirect to the test wallet's
   consent page → back to `/callback?interact_ref=...` → `grant.continue` → access token.
4. **Send:** `outgoingPayment.create(quoteId)` → money moves → receipt.

State carried across the consent redirect (`quote.id`, grant continuation token/uri) is kept
**server-side**, keyed by the grant nonce — never in the browser.

## Currency

Currency-agnostic: asset code + scale are read dynamically from each wallet and the quote and shown
as-is. Target demo is **USD → XCG**; falls back to any offered asset (EUR/MXN) with no code change.

## Key decisions log

| Date | Decision | Why |
|------|----------|-----|
| 2026-06-13 | Repo scaffolded as `sxm-fintech` (placeholder name) | Setting up structure ahead of product definition |
| 2026-06-13 | Scope = Open Payments cross-border B2B payment POC for a grant | User's grant application |
| 2026-06-13 | Next.js + TS; `@interledger/open-payments` SDK | User chose Next.js; SDK is the official client |
| 2026-06-13 | Currency-agnostic (target USD→XCG, fallback EUR/MXN) | XCG availability on test wallet unconfirmed |
| 2026-06-13 | No custody/ledger module; `lib/payments/` sole OP layer; key server-side | Platform must never hold funds |
| 2026-06-13 | One branch per build part, merge to main | User wants to understand each part independently |
