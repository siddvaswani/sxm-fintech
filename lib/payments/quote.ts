// lib/payments/quote.ts
//
// PART 3 — "Find out the price: how much must A pay so B receives what B asked for?"
//
// This is the sender side of the flow AND the most important UX moment in the whole demo.
// Part 2 created an "incoming payment" on Business B (a destination slot with a fixed amount
// in B's currency). Here we point a QUOTE at that slot and ask the network: given that B must
// receive Y in B's currency, how much must A pay in A's currency — including the FX conversion
// and any network fee? That answer is what we show the user BEFORE they confirm and send.
//
// Same two-beat rhythm as Part 2:
//   1. ask for a GRANT (a permission token), then
//   2. USE that token to create the resource (here: the quote).
//
// Custody note: a quote is just a price calculation. No money moves here, and we never hold a
// balance. We're only asking the sender's wallet "what would this cost?".

import 'server-only'
import { isFinalizedGrantWithAccessToken } from '@interledger/open-payments'
import { getOpenPaymentsClient } from './client'
import { fromMinorUnits } from './amounts'

// An Open Payments amount is always this trio: an integer string of minor units plus the
// currency's code and scale. We re-declare the shape here so our return type is self-describing
// (in Python this is like a small TypedDict). `value` is a STRING on purpose — money is never a
// float (see amounts.ts for why).
export interface Amount {
  value: string // integer string in the asset's smallest unit, e.g. "18000"
  assetCode: string // the currency, read live from the quote (never hardcoded)
  assetScale: number // how many decimal places that currency uses
}

// `interface` describes the shape of an object — like a typed dict in Python.
// This is the clean result Part 6's UI (and Part 4/5) will consume.
export interface QuoteResult {
  id: string // the quote URL — Part 5 passes this to outgoingPayment.create
  debitAmount: Amount // what A PAYS, in A's (sender) currency
  receiveAmount: Amount // what B GETS, in B's (receiver) currency
  // A small, display-ready summary derived from the two amounts above. Everything here is
  // COMPUTED from real quote data — never faked — so the screen shows the true FX + fee.
  display: {
    debit: string // e.g. "10.00" — human-readable amount A pays
    receive: string // e.g. "18.00" — human-readable amount B receives
    exchangeRate: string // e.g. "1.800000" — receive per 1 unit of debit
    feeValue: string // network fee, human-readable, in the SENDER's currency
  }
}

/**
 * Create a quote on the SENDER's wallet (Business A) for a given incoming payment.
 *
 * @param senderWalletUrl    Business A's wallet address URL (who pays).
 * @param incomingPaymentId  The incoming payment URL from Part 2 (the receiver / destination).
 *                           This is `IncomingPaymentSetup.id`.
 *
 * Returns both amounts plus a derived fee/rate summary to surface before the user confirms.
 */
export async function createQuote(
  senderWalletUrl: string,
  incomingPaymentId: string,
): Promise<QuoteResult> {
  const client = await getOpenPaymentsClient()

  // Resolve the sender's wallet → gives us its servers AND its currency (assetCode/assetScale).
  // We read the currency live here, which is what keeps the app currency-agnostic: USD, XCG,
  // EUR — whatever A's wallet actually uses is what flows through.
  const sender = await client.walletAddress.get({ url: senderWalletUrl })

  // Beat 1 — request a grant. Asking for a price quote is harmless (no money moves), so this
  // grant is non-interactive: no human approval, the token comes straight back.
  const grant = await client.grant.request(
    { url: sender.authServer },
    {
      access_token: {
        access: [
          {
            type: 'quote',
            actions: ['create', 'read', 'read-all'],
          },
        ],
      },
    },
  )

  // `isFinalizedGrantWithAccessToken` is a type guard: it's true only when the grant is done AND
  // carries a usable token. A non-interactive grant should satisfy it immediately. If it doesn't,
  // the wallet wanted interaction we didn't expect here. Past this check, TypeScript also knows
  // `grant.access_token` is definitely present (so `.value` below is safe).
  if (!isFinalizedGrantWithAccessToken(grant)) {
    throw new Error(
      'Sender quote grant did not return an access token; expected an automatic grant.',
    )
  }

  // Beat 2 — use the token to create the quote on the SENDER's resource server.
  // `method: 'ilp'` = settle over Interledger. `receiver` is the incoming payment URL from Part 2;
  // the network works backward from "B must receive Y" to "A must pay X", applying FX + fees.
  const quote = await client.quote.create(
    { url: sender.resourceServer, accessToken: grant.access_token.value },
    {
      method: 'ilp',
      walletAddress: sender.id,
      receiver: incomingPaymentId,
    },
  )

  // The quote carries both sides of the deal as Open Payments amounts.
  const debitAmount = quote.debitAmount // what A pays   (sender currency)
  const receiveAmount = quote.receiveAmount // what B gets   (receiver currency)

  // --- Derive the display summary from the REAL amounts (nothing faked) ----------------------
  // Human-readable versions of each side, using the existing string-based money helper.
  const debitHuman = fromMinorUnits(debitAmount.value, debitAmount.assetScale)
  const receiveHuman = fromMinorUnits(receiveAmount.value, receiveAmount.assetScale)

  // Exchange rate = how much B receives for each 1.00 unit A pays. We compute it from the two
  // human decimal strings. `Number(...)` is JS's `float(...)`; we only use floats for DISPLAY
  // here (never to move money), so rounding for readability is fine. Guard against divide-by-zero
  // if a debit somehow came back as 0.
  const debitNum = Number(debitHuman)
  const receiveNum = Number(receiveHuman)
  const exchangeRate =
    debitNum === 0 ? '0' : (receiveNum / debitNum).toFixed(6)

  // Fee — and the honest limit of what we can claim here:
  //
  // When debit and receive are in the SAME currency, the fee is exact and obvious: it's whatever
  // A pays beyond what B receives (debit - receive). We compute that in minor-unit integers with
  // BigInt so it's penny-precise. BigInt is JS's arbitrary-precision integer (like Python's plain
  // `int`); the trailing `n` (e.g. `0n`) just marks a literal as a BigInt.
  //
  // When the currencies DIFFER (the real cross-border case), there is no honest way to split the
  // single `debitAmount` into "FX" vs "fee" without an external reference market rate, which the
  // quote does not give us. Faking one would violate the spec's "never faked" rule. So in the
  // cross-currency case the COST story is carried entirely by `exchangeRate` above, and we report
  // the same-currency fee as "0" (there's no same-currency surcharge to add on top of the rate).
  //
  // Note: we call `BigInt(...)` rather than writing the `0n` literal form, because this repo's
  // tsconfig targets ES2017 and the literal syntax needs ES2020. The values themselves are still
  // arbitrary-precision integers (like Python's `int`), so the subtraction stays penny-exact.
  let feeValue: string
  if (debitAmount.assetCode === receiveAmount.assetCode) {
    const feeMinor = BigInt(debitAmount.value) - BigInt(receiveAmount.value)
    const feeMinorClamped = feeMinor < BigInt(0) ? BigInt(0) : feeMinor // rounding can't go negative
    feeValue = fromMinorUnits(feeMinorClamped.toString(), debitAmount.assetScale)
  } else {
    feeValue = fromMinorUnits('0', debitAmount.assetScale)
  }

  return {
    id: quote.id,
    debitAmount: {
      value: debitAmount.value,
      assetCode: debitAmount.assetCode,
      assetScale: debitAmount.assetScale,
    },
    receiveAmount: {
      value: receiveAmount.value,
      assetCode: receiveAmount.assetCode,
      assetScale: receiveAmount.assetScale,
    },
    display: {
      debit: debitHuman,
      receive: receiveHuman,
      exchangeRate,
      feeValue,
    },
  }
}
