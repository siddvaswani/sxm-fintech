// app/api/quote/route.ts
//
// PART 6 — API route for the FIRST half of the flow: "set up the destination, then price it."
//
// A file named `route.ts` under app/api/<name>/ is a backend endpoint (no UI). The Start
// screen POSTs the amount here. This route does the two server-side steps the browser must
// never do itself (they touch the private key):
//   1. Part 2 — setupIncomingPayment(): create Business B's incoming payment (the invoice).
//   2. Part 3 — createQuote(): ask the network what Business A must pay to fill it (FX + fee).
// It returns the QuoteResult, which the Review screen shows before the user confirms.
//
// (This is the TS/Next equivalent of a Flask `@app.post('/api/quote')` handler.)

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { setupIncomingPayment } from '@/lib/payments/incoming'
import { createQuote } from '@/lib/payments/quote'

// Read a required env var or fail loudly. The two business wallet addresses live in .env
// (server-side only); the browser never sees them. (client.ts has its own copy of this for
// the platform credentials — kept local here so each route is self-contained.)
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env (see SETUP.md).`,
    )
  }
  return value
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // The browser sends `{ amount: "10.00" }` — how much Business B should RECEIVE, in B's
    // own currency (the invoice model). `await request.json()` parses the JSON body.
    const body = (await request.json()) as { amount?: unknown }
    const amount = String(body.amount ?? '').trim()

    // Validate: must be a positive number. `Number(...)` is JS's float(); we only use it to
    // CHECK the input here, never to move money (the lib layer does money math as strings).
    const amountNum = Number(amount)
    if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { ok: false, message: 'Enter an amount greater than zero.' },
        { status: 400 },
      )
    }

    const senderWalletUrl = requireEnv('SENDER_WALLET_ADDRESS') // Business A (pays)
    const receiverWalletUrl = requireEnv('RECEIVER_WALLET_ADDRESS') // Business B (receives)

    // Step 1 (Part 2): create B's incoming payment for that amount in B's currency.
    const incoming = await setupIncomingPayment(receiverWalletUrl, amount)

    // Step 2 (Part 3): point a quote at it from A's wallet → the FX + fee the user will see.
    const quote = await createQuote(senderWalletUrl, incoming.id)

    return NextResponse.json({ ok: true, quote })
  } catch (err) {
    // Surface a readable message (e.g. missing .env, or the test wallet rejecting a request)
    // instead of a stack trace. Until the user adds real credentials, this is the expected
    // path — there's no live run without the wallets + key (built in SETUP.md, last).
    const message = err instanceof Error ? err.message : 'Unexpected error creating the quote.'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
