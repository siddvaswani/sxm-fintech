// app/api/send/route.ts
//
// PART 6 — API route for the SECOND half: "ask for the sender's approval to spend."
//
// The Review screen POSTs here when the user clicks "Confirm & Send". This route does
// Part 4's first beat: request the INTERACTIVE outgoing-payment grant and stash the
// server-side state we'll need after the browser comes back. It returns the wallet's
// approval URL; the browser then navigates there so the human can approve.
//
//   browser → /api/send → requestOutgoingGrant() → stash state → return redirectUrl
//   browser → (wallet approval page) → approve → /callback → finish + send (Parts 4/5)
//
// We do NOT create the payment here — that only happens AFTER approval, in /callback.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getOpenPaymentsClient } from '@/lib/payments/client'
import { requestOutgoingGrant } from '@/lib/payments/outgoing-grant'
import type { DebitAmount } from '@/lib/payments/outgoing-grant'
import { saveRedirectState } from '@/lib/payments/redirect-state'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env (see README.md).`,
    )
  }
  return value
}

// Minimal shape-check for the amount the browser echoes back from the quote. (TypeScript
// types vanish at runtime, so we verify the incoming JSON by hand — like checking a dict.)
function isDebitAmount(x: unknown): x is DebitAmount {
  if (typeof x !== 'object' || x === null) return false
  const a = x as Record<string, unknown>
  return (
    typeof a.value === 'string' &&
    typeof a.assetCode === 'string' &&
    typeof a.assetScale === 'number'
  )
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // From the Review screen: the quote id (the locked-in price) and its debitAmount (used as
    // the grant's spend limit). Both came from our own /api/quote moments ago. The real charge
    // is bound to `quoteId` when the payment is created in /callback, so the debitAmount here
    // only sets the approval ceiling — safe to take from the client for this test-money POC.
    const body = (await request.json()) as { quoteId?: unknown; debitAmount?: unknown }
    const quoteId = typeof body.quoteId === 'string' ? body.quoteId : ''

    if (!quoteId || !isDebitAmount(body.debitAmount)) {
      return NextResponse.json(
        { ok: false, message: 'Missing or invalid quote — get a fresh quote and try again.' },
        { status: 400 },
      )
    }

    const senderWalletUrl = requireEnv('SENDER_WALLET_ADDRESS')
    const client = await getOpenPaymentsClient()

    // Part 4, beat 1 — request the interactive grant. Comes back "pending": a redirect URL to
    // send the browser to, plus the `continue` credentials + nonce to finish it afterwards.
    const pending = await requestOutgoingGrant(client, senderWalletUrl, body.debitAmount)

    // Stash everything /callback will need AFTER the redirect, keyed by the nonce. This is the
    // app's ONE bit of server-side state. We include quoteId + senderWalletUrl so the callback
    // can create the outgoing payment (Part 5) once the grant is finalized.
    saveRedirectState({
      continueAccessToken: pending.continueAccessToken,
      continueUri: pending.continueUri,
      nonce: pending.nonce,
      quoteId,
      senderWalletUrl,
    })

    // Hand the browser the wallet's approval URL. The Review screen navigates the window here.
    return NextResponse.json({ ok: true, redirectUrl: pending.redirectUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error starting the payment.'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
