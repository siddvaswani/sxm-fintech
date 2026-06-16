// lib/payments/outgoing.ts
//
// PART 5 — "Actually send the money, then hand back a receipt."
//
// This is the payoff of the whole flow. By now the earlier parts have done all the
// setup:
//   Part 2 — created Business B's incoming payment (the destination + how much B receives)
//   Part 3 — got a QUOTE (the exact price A pays, incl. FX + fee) → quote.id
//   Part 4 — got the sender's interactive approval → a finalized access token
//
// Part 5 takes the last two of those — the quote id and the approved token — and tells
// the sender's wallet "go": create the OUTGOING payment. THIS is the step where the test
// wallets actually move funds from A to B. Everything before it was preparation.
//
// One beat only (no separate grant request): Part 4 already obtained the token this call
// needs, so here we just USE it. That's why this file takes the token as a parameter
// instead of requesting a grant like Parts 2/3 did.
//
// Custody note: even now, WE don't move the money. We hand the sender's wallet a signed
// "create this outgoing payment" instruction, capped at the amount the user approved, and
// the test wallets (the "banks") do the settling. We never hold a balance — the receipt we
// return is read straight back from the wallet, not from any ledger of our own.

import 'server-only'
import type { OpenPaymentsClient } from './client'
import { fromMinorUnits } from './amounts'

// An Open Payments amount is always this trio: an integer string of minor units plus the
// currency's code and scale. We re-declare the shape locally (same as quote.ts and
// outgoing-grant.ts do) so this module's return type is self-describing and the parts stay
// loosely coupled. `value` is a STRING on purpose — money is never a float (see amounts.ts).
export interface Amount {
  value: string // integer string in the asset's smallest unit, e.g. "1000"
  assetCode: string // currency code, read live from the payment (never hardcoded)
  assetScale: number // how many decimal places that currency uses
}

// The clean receipt Part 6's "Result" screen will show. Everything here is read back from
// the real outgoing payment the wallet created — nothing is faked or assumed.
export interface PaymentReceipt {
  id: string // the outgoing payment URL — the canonical proof it was created
  failed: boolean // the wallet's own flag: did the payment fail outright?
  receiver: string // the incoming payment URL the funds were sent to (Business B)
  createdAt: string // ISO timestamp the wallet stamped on creation
  debitAmount: Amount // what A is charged (sender currency) — matches the quote
  receiveAmount: Amount // what B receives (receiver currency) — matches the quote
  sentAmount: Amount // how much has actually been sent so far (settlement can lag)
  // Display-ready strings derived from the real amounts above, for the receipt screen.
  display: {
    debit: string // e.g. "10.00" — human-readable amount A paid
    receive: string // e.g. "18.00" — human-readable amount B receives
    sent: string // e.g. "10.00" — human-readable amount sent so far
    status: string // "Sent" or "Failed" — a friendly summary of `failed`
  }
}

/**
 * Create the outgoing payment on the SENDER's wallet (Business A) — the step that moves money.
 *
 * @param client          The shared authenticated client (from getOpenPaymentsClient()).
 * @param senderWalletUrl Business A's wallet address URL — the account that pays.
 * @param accessToken     The FINALIZED outgoing-payment token from Part 4
 *                        (continueOutgoingGrant). This is what authorizes the spend, capped
 *                        at the amount the user approved.
 * @param quoteId         The quote URL from Part 3 (createQuote → QuoteResult.id). The quote
 *                        already locked in the exact debit/receive amounts and FX, so we don't
 *                        re-specify amounts here — the wallet reads them from the quote.
 *
 * Returns a receipt read straight back from the created payment.
 */
export async function createOutgoingPayment(
  client: OpenPaymentsClient,
  senderWalletUrl: string,
  accessToken: string,
  quoteId: string,
): Promise<PaymentReceipt> {
  // Resolve the sender's wallet → gives us its resource server (where payments are created)
  // and its canonical id (used as the `walletAddress` on the create call). Same first move
  // as quote.ts; we read everything live to stay currency-agnostic.
  const sender = await client.walletAddress.get({ url: senderWalletUrl })

  // The single beat: USE the approved token to create the outgoing payment on the sender's
  // resource server. We pass the quote id (not raw amounts) so the payment is bound to the
  // exact price the user saw and approved — no chance of charging a different number than the
  // one on the confirm screen. `method`/amounts live inside the quote already.
  const outgoingPayment = await client.outgoingPayment.create(
    { url: sender.resourceServer, accessToken },
    {
      walletAddress: sender.id,
      quoteId,
    },
  )

  // Read the three amounts back off the created payment. `sentAmount` is what has actually
  // settled so far — on the test network it's typically the full debit immediately, but the
  // field exists because settlement can lag, so we surface it honestly rather than assume.
  const debitAmount = outgoingPayment.debitAmount
  const receiveAmount = outgoingPayment.receiveAmount
  const sentAmount = outgoingPayment.sentAmount

  // Human-readable versions for the receipt, using the existing string-based money helper
  // (never floats for money). Each uses its OWN assetScale so mixed currencies render right.
  const debitHuman = fromMinorUnits(debitAmount.value, debitAmount.assetScale)
  const receiveHuman = fromMinorUnits(receiveAmount.value, receiveAmount.assetScale)
  const sentHuman = fromMinorUnits(sentAmount.value, sentAmount.assetScale)

  return {
    id: outgoingPayment.id,
    failed: outgoingPayment.failed,
    receiver: outgoingPayment.receiver,
    createdAt: outgoingPayment.createdAt,
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
    sentAmount: {
      value: sentAmount.value,
      assetCode: sentAmount.assetCode,
      assetScale: sentAmount.assetScale,
    },
    display: {
      debit: debitHuman,
      receive: receiveHuman,
      sent: sentHuman,
      // `failed` is the wallet's own flag; turn it into a friendly word for the screen.
      status: outgoingPayment.failed ? 'Failed' : 'Sent',
    },
  }
}
