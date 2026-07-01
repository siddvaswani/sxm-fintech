# SXM Fintech — Cross-Border B2B Payment (Open Payments PoC)

A proof of concept that sends **one real cross-currency business-to-business payment** over
[Open Payments](https://openpayments.dev) on the Interledger network — showing the **exact fee and
exchange rate before the payer confirms**, and holding **no customer funds** at any point.

Built for small and medium businesses in **Sint Maarten** that pay overseas suppliers and today lose
a stack of flat fees, correspondent charges, and an opaque FX margin to a single incumbent bank.

> **Status:** ✅ Verified end-to-end on the Interledger **test** network (2026-06-17) — Business A (USD)
> paid Business B (EUR), quote → approve → send → settle, with funds moving on both wallets and the
> platform holding nothing. **Test money only.**

---

## What it demonstrates

1. **Transparent pricing** — the payer sees what they pay, what the supplier receives, the exchange
   rate, and the fee **on the review screen, before confirming**. Nothing is hidden in the spread.
2. **Non-custodial by design** — the app is only an Open Payments **client**: it signs and routes
   payment instructions. The two wallets (Account Servicing Entities) custody and settle all money.
   There is **no ledger, balance, or funds-holding code anywhere** — its absence is the guarantee.
3. **Currency-agnostic** — asset code and scale are read live from each wallet; the target corridor is
   USD → XCG (Caribbean Guilder), with automatic fallback to any asset the test wallet offers.

## The payment flow (Open Payments sequence)

```
Start ──▶ Review quote ──▶ Approve at wallet ──▶ Receipt
(enter    (fee + FX rate    (interactive GNAP     (/result)
 amount)   shown here)       consent redirect)
```

1. **Recipient setup (Business B):** incoming-payment grant → create incoming payment → payment id.
2. **Quote (Business A):** quote grant → create quote → returns `debitAmount` (A pays) and
   `receiveAmount` (B gets). **Fee + exchange rate are surfaced here, before confirm.**
3. **Authorize (Business A):** interactive outgoing-payment grant → browser redirects to the wallet's
   consent page → returns to `/callback` → `grant.continue` → access token.
4. **Send:** create the outgoing payment bound to the `quoteId` → money moves → receipt at `/result`.

State carried across the consent redirect (quote id, grant continuation token) is kept **server-side**,
keyed by the grant nonce — never exposed to the browser.

## Tech stack

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript** · **Tailwind CSS 4**
- **`@interledger/open-payments` 7.4** — the official Open Payments SDK
- Node 22+. Private key is server-side only (enforced with `server-only`).

## Project structure

```
app/
  page.tsx              # Start + Review screens (client component)
  callback/route.ts     # Return URL after the payer approves at the wallet
  result/page.tsx       # Receipt (server component)
  api/quote/route.ts    # incoming-payment + quote (steps 1–2)
  api/send/route.ts     # continue grant + create outgoing payment (steps 3–4)
lib/payments/           # the ONLY layer that talks to Open Payments — stateless, no funds
  client.ts             # createAuthenticatedClient (sole credential holder)
  amounts.ts            # string-based minor-unit money math
  incoming.ts           # grant + incomingPayment.create (Business B)
  quote.ts              # grant + quote.create (Business A) → debit/receive amounts
  outgoing-grant.ts     # interactive grant + grant.continue
  outgoing.ts           # outgoingPayment.create → receipt
  redirect-state.ts     # server-side, nonce-keyed stash for the consent redirect (PoC only)
```

## Running it locally

You need two wallets on the free Interledger test network.

1. **Create test wallets & a key** at [wallet.interledger-test.dev](https://wallet.interledger-test.dev):
   Business A (sender, USD), Business B (receiver, EUR/XCG), and a developer key pair on the sender.
2. **Configure** — copy the example env and fill it in:
   ```bash
   cp .env.example .env
   # set CLIENT/SENDER/RECEIVER wallet addresses, KEY_ID, and place private.key at the repo root
   ```
   `.env` and `private.key` are gitignored and never committed.
3. **Install & run:**
   ```bash
   npm install
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000), enter an amount for Business B to receive,
   review the fee + rate, approve at the wallet, and land on the receipt.

## Scope & honesty

This is a **grant proof of concept**, not a production product. It moves **test money only** on the
Interledger test network. The production path — a regulated settlement partner for the receiving leg
and an XCG connector (no XCG Open Payments wallet exists on the network yet) — is the work the
accelerator is intended to fund.
