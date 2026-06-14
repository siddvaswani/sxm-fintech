// lib/payments/incoming.ts
//
// PART 2 — "Set up where the money lands on Business B."
//
// This is the receiver side of the flow. Before anyone can pay Business B, B has to
// create an "incoming payment": a destination slot with an amount and a currency, and
// a unique URL. Think of it like B issuing an invoice. That URL is what Part 3's quote
// will point at ("how much will it cost to fill THIS slot?").
//
// The two-beat rhythm you'll see again and again:
//   1. ask for a GRANT (a permission token), then
//   2. USE that token to create/read a resource.

import 'server-only'
import { isFinalizedGrantWithAccessToken } from '@interledger/open-payments'
import { getOpenPaymentsClient } from './client'
import { toMinorUnits } from './amounts'

// `interface` describes the shape of an object — like a typed dict in Python.
// This is what Part 3 receives from us.
export interface IncomingPaymentSetup {
  id: string // the incoming payment URL — the quote targets this
  walletAddress: string // the receiver's canonical wallet address
  assetCode: string // the receiver's currency (read live, never hardcoded)
  assetScale: number
}

/**
 * Create an incoming payment on the receiver's wallet (Business B).
 *
 * @param receiverWalletUrl  Business B's wallet address URL.
 * @param receiveAmount      How much B should receive, as a human number ("180" / "10.00")
 *                           in B's OWN currency. We discover that currency from the wallet.
 */
export async function setupIncomingPayment(
  receiverWalletUrl: string,
  receiveAmount: string | number,
): Promise<IncomingPaymentSetup> {
  const client = await getOpenPaymentsClient()

  // Resolve the wallet → gives us its servers AND its currency (assetCode/assetScale).
  // This is why the app is currency-agnostic: we read XCG/EUR/USD from here, not a constant.
  const receiver = await client.walletAddress.get({ url: receiverWalletUrl })

  // Beat 1 — request a grant. Creating a place to RECEIVE money is harmless, so this
  // grant is non-interactive: no human approval, the token comes straight back.
  const grant = await client.grant.request(
    { url: receiver.authServer },
    {
      access_token: {
        access: [
          {
            type: 'incoming-payment',
            actions: ['list', 'read', 'read-all', 'complete', 'create'],
          },
        ],
      },
    },
  )

  // `isFinalizedGrantWithAccessToken` is a type guard: it's true only when the grant
  // is done AND carries a usable token. A non-interactive grant should satisfy it
  // immediately. If it doesn't, the wallet wanted interaction we didn't expect here.
  // Past this check, TypeScript also knows `grant.access_token` is definitely present.
  if (!isFinalizedGrantWithAccessToken(grant)) {
    throw new Error(
      'Receiver grant did not return an access token; expected an automatic grant.',
    )
  }

  // Beat 2 — use the token to create the incoming payment (the destination slot).
  const incomingPayment = await client.incomingPayment.create(
    { url: receiver.resourceServer, accessToken: grant.access_token.value },
    {
      walletAddress: receiver.id,
      incomingAmount: {
        value: toMinorUnits(receiveAmount, receiver.assetScale),
        assetCode: receiver.assetCode,
        assetScale: receiver.assetScale,
      },
      // Give it a short life so stale slots don't linger (10 minutes).
      expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
    },
  )

  return {
    id: incomingPayment.id,
    walletAddress: receiver.id,
    assetCode: receiver.assetCode,
    assetScale: receiver.assetScale,
  }
}
