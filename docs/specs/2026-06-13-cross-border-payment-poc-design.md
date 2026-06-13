# Design Spec — Cross-Border B2B Payment POC (Open Payments)

_Date: 2026-06-13 · Status: **Approved, not yet built** · Stack decided: Next.js (App Router) + TypeScript_

> This is a proof of concept for a **grant application**. Test money only (Interledger test wallet). No real funds, no production concerns. The point is to demo a cross-border B2B payment that visibly shows the FX conversion + fee before the sender confirms, with a clean **platform-never-custodies-funds** architecture.

---

## 1. What we're building (one paragraph)

A small Next.js app that initiates **one** cross-currency B2B payment — **Business A → Business B** — over the **Open Payments** protocol on the Interledger **test** wallet, using the official **`@interledger/open-payments`** Node SDK. The app walks through the full Open Payments sequence (grant → incoming payment → quote → outgoing payment). The key UX moment: after the **quote** step, the user sees the **fee and exchange rate** and must click **Confirm** before the payment is sent.

## 2. Custody model (the architectural point of the demo)

The platform is a **payment initiator, not a custodian.** It never holds, pools, or settles funds and has **no balance of its own**. The two test wallets (Account Servicing Entities / "the banks") custody and settle the money. Open Payments makes this native: our app is only the GNAP **client** that signs requests and routes payment instructions.

Enforced in code structure:
- **`lib/payments/`** — the ONLY place that talks to Open Payments. Stateless. No DB, no balances, no funds-holding.
- **`app/`** — UI + thin API routes. Calls into `lib/payments/`. No money logic.
- **There is deliberately no ledger / balance / wallet-of-our-own module anywhere.** Its absence is the proof.
- The **private key lives server-side only** (API routes / server code), never shipped to the browser.

`ARCHITECTURE.md` carries a short "Custody Model" note restating this.

## 3. Currency: agnostic by design (resolves the XCG uncertainty)

**Decision: the target currency is Caribbean Guilder (XCG)** — on-brand for SXM — **but we could NOT confirm** the live test wallet (`wallet.interledger-test.dev`) currently offers XCG as a selectable asset (XCG is brand new, 2025). So:

- **The app hardcodes NO currency.** It reads `assetCode` + `assetScale` dynamically from each wallet address and from the quote, and displays whatever comes back.
- At setup, create **Business A = USD**, **Business B = XCG** *if the wallet offers it* → demo shows **USD → XCG**.
- If XCG isn't available, pick the closest offered asset (e.g. EUR or MXN). **No code change required** — the UI shows whatever the real wallets use.
- The FX/fee figures are computed from real quote data (`debitAmount` vs `receiveAmount`), never faked.

> ⚠️ Laptop session: confirm XCG availability when creating the wallets. Keep currency-agnostic regardless.

## 4. Tech stack

- **Next.js (App Router) + TypeScript.** (User chose Next.js over a plainer Express+HTML option.)
- Backend = **API routes** under `app/api/...`, one route per real step, named after the step.
- Frontend = **3 simple pages**: Start → **Review quote (fee + rate)** → Result.
- Generous comments; explain TypeScript-vs-Python idioms inline (user comes from Python, is non-technical).
- Secrets (private key) **server-side only**.

## 5. The verified Open Payments flow (pulled from official Node snippets, not memory)

SDK: **`@interledger/open-payments`** (latest 7.x). Source of truth verified 2026-06-13 from
`github.com/interledger/open-payments/snippets/node/*`.

**Auth client** (one per process; needs three credentials):
```ts
import { createAuthenticatedClient } from '@interledger/open-payments'

const client = await createAuthenticatedClient({
  walletAddressUrl: CLIENT_WALLET_ADDRESS, // our platform's wallet address URL (identity; holds no money)
  privateKey: PRIVATE_KEY_PATH,            // path to private.key downloaded from the test wallet
  keyId: KEY_ID                            // shown in the test wallet's Developer Keys tab
})
```

Every wallet address resolves to its servers:
```ts
const wallet = await client.walletAddress.get({ url: WALLET_ADDRESS })
// wallet.authServer      → where you request grants
// wallet.resourceServer  → where you create resources
// wallet.assetCode / wallet.assetScale → the currency (use these, don't hardcode)
```

### Step 1 — Recipient (Business B): incoming-payment grant, then create incoming payment
Grant is **non-interactive** (machine-to-machine):
```ts
const grant = await client.grant.request(
  { url: receiverWallet.authServer },
  { access_token: { access: [{
      type: 'incoming-payment',
      actions: ['list', 'read', 'read-all', 'complete', 'create']
  }]}}
)
// guard: if (isFinalizedGrantWithAccessToken(grant)) throw  // expect a finalized non-interactive grant w/ token
```
Create the incoming payment on B's resource server:
```ts
const incomingPayment = await client.incomingPayment.create(
  { url: receiverWallet.resourceServer, accessToken: grant.access_token.value },
  {
    walletAddress: RECEIVER_WALLET_ADDRESS,
    incomingAmount: { value: '1000', assetCode: receiverWallet.assetCode, assetScale: receiverWallet.assetScale },
    expiresAt: new Date(Date.now() + 60_000 * 10).toISOString()
  }
)
// incomingPayment.id  ← used as the quote's `receiver`
```
> Note: `value` is an integer string in the asset's smallest unit (assetScale 2 → '1000' = 10.00).

### Step 2 — Sender (Business A): quote grant, then create quote → **THE FX MOMENT**
```ts
const quoteGrant = await client.grant.request(
  { url: senderWallet.authServer },
  { access_token: { access: [{ type: 'quote', actions: ['create', 'read', 'read-all'] }]}}
)
const quote = await client.quote.create(
  { url: senderWallet.resourceServer, accessToken: quoteGrant.access_token.value },
  { method: 'ilp', walletAddress: SENDER_WALLET_ADDRESS, receiver: incomingPayment.id }
)
// quote.id
// quote.debitAmount   → { value, assetCode, assetScale }  what A pays   (sender currency)
// quote.receiveAmount → { value, assetCode, assetScale }  what B gets   (receiver currency)
// FX + fee = the relationship between debitAmount and receiveAmount → SHOW THIS BEFORE CONFIRM
```

### Step 3 — Sender authorization: INTERACTIVE outgoing-payment grant + consent redirect
This one needs a human to approve. The grant request includes `interact` with a `finish.uri` = our callback page:
```ts
import { isPendingGrant } from '@interledger/open-payments'

const grant = await client.grant.request(
  { url: senderWallet.authServer },
  {
    access_token: { access: [{
      identifier: senderWallet.id,
      type: 'outgoing-payment',
      actions: ['list', 'list-all', 'read', 'read-all', 'create'],
      limits: { debitAmount: {
        assetCode: quote.debitAmount.assetCode,
        assetScale: quote.debitAmount.assetScale,
        value: quote.debitAmount.value
      }}
    }]},
    interact: {
      start: ['redirect'],
      finish: { method: 'redirect', uri: 'http://localhost:3000/callback', nonce: NONCE }
    }
  }
)
// guard: if (!isPendingGrant(grant)) throw
// grant.interact.redirect       → send the user's browser here to approve
// grant.continue.access_token.value + grant.continue.uri → needed to finish after they return
```
User approves at the test wallet's IdP, gets redirected back to `/callback?interact_ref=...&hash=...`.

### Step 3b — Continue the grant (after the redirect back)
```ts
import { isFinalizedGrantWithAccessToken } from '@interledger/open-payments'

const interactRef = new URL(returnedUrl).searchParams.get('interact_ref') // throw if missing
const finalized = await client.grant.continue(
  { accessToken: grant.continue.access_token.value, url: grant.continue.uri },
  { interact_ref: interactRef }
)
// guard: if (!isFinalizedGrantWithAccessToken(finalized)) throw
// finalized.access_token.value → token to create the outgoing payment
// (TODO when hardening: verify the returned `hash` per spec — snippet leaves it as a @TODO)
```

### Step 4 — Create the outgoing payment (money moves)
```ts
const outgoingPayment = await client.outgoingPayment.create(
  { url: senderWallet.resourceServer, accessToken: finalized.access_token.value },
  { walletAddress: SENDER_WALLET_ADDRESS, quoteId: quote.id }
)
// outgoingPayment.id → show on the receipt screen
```

**State to carry across the redirect** (server-side, e.g. a signed cookie or in-memory keyed by nonce — NOT the browser): `quote.id`, `grant.continue.*`, sender wallet address. This is the one stateful wrinkle and must stay server-side.

## 6. Screens (3)

1. **Start** — "Business A pays Business B." Enter/confirm an amount. [Get quote].
2. **Review quote** — "You send **X USD** → Business B receives **Y XCG**. Rate 1 USD = … · Fee …". [Confirm & Send] / [Cancel]. ← the UX moment.
3. **Result** — redirect to the test wallet to approve, then back to a **receipt** ("✅ Sent", outgoing payment id, both amounts).

## 7. Environment / credentials (`.env`, server-side only)

```
CLIENT_WALLET_ADDRESS=    # platform's own wallet address URL (identity, holds no money)
KEY_ID=                   # from test wallet → Developer Keys
PRIVATE_KEY_PATH=         # path to private.key file
SENDER_WALLET_ADDRESS=    # Business A (USD)
RECEIVER_WALLET_ADDRESS=  # Business B (XCG if available, else EUR/MXN)
```
`.env` and `*.key` are gitignored. A `.env.example` ships with blanks. `SETUP.md` will give a screenshot-level walkthrough for creating the wallets + key at `wallet.interledger-test.dev`.

> Simplest test-wallet setup: the platform **client** wallet can be the same as Business A's wallet (its key signs). Cleaner custody story = a dedicated 3rd "platform" wallet that holds no money but owns the key. Laptop session: pick based on how many test accounts you want to create. Default to the simpler 2-wallet setup if short on time, and note it.

## 8. Build order — one branch per part, merged to `main`

Each branch is small; write a plain-English summary before merging; update `CURRENT_STATE.md` after each.

1. `feat/01-app-scaffold` — Next.js + TS app, `.env.example`, `lib/payments/client.ts` (authenticated client), `ARCHITECTURE.md` custody note.
2. `feat/02-recipient-setup` — incoming-payment grant + `incomingPayment.create` (Business B).
3. `feat/03-quote-and-fx` — quote grant + `quote.create`; expose debit/receive amounts + fee/rate.
4. `feat/04-consent-redirect` — interactive outgoing grant + `/callback` route + `grant.continue` (incl. server-side state across redirect).
5. `feat/05-send-payment` — `outgoingPayment.create` + receipt.
6. `feat/06-ui-wire-up` — the 3 screens tying it together, with the Review/Confirm step.
7. (last) `SETUP.md` + final `CURRENT_STATE.md`.

## 9. What can / can't be verified

- ✅ Code written, type-checked, reviewed branch by branch.
- ❌ **No live end-to-end run without the user's test-wallet accounts + key.** First real run is the user's, guided by `SETUP.md`.

## 10. Out of scope (v1 — do NOT add)

- Reverse direction (B → A), multiple payments, real names/branding.
- Any funds custody, ledger, balances, or settlement logic (intentionally — that's an external licensed entity's job).
- Production concerns (real keys, scaling, auth/login, persistence beyond the redirect state).
- Polished UI.

## 11. Open decisions for the laptop session

1. **Re-fetch the live docs first** (`openpayments.dev` + the `interledger/open-payments` snippets) to confirm nothing changed since 2026-06-13 — then trust the snippets captured above.
2. Confirm **XCG availability** on the test wallet; fall back if absent (app stays currency-agnostic either way).
3. Choose **2-wallet** (client = sender) vs **3-wallet** (dedicated platform client) setup.
