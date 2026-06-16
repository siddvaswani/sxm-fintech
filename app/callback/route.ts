// app/callback/route.ts
//
// PART 4 — the landing page the test wallet redirects the browser back to after the
// sender approves (or declines) the payment.
//
// In Next.js's App Router, a file named `route.ts` inside `app/<path>/` is an API
// endpoint (no UI), and an exported `GET` function handles GET requests to that path.
// So this whole file = "what happens when the browser hits /callback?...". This is the
// TypeScript/Next equivalent of a single Flask route: `@app.get('/callback')`.
//
// The IdP returns the browser here as: /callback?interact_ref=...&hash=...&result=...
// Our job: read interact_ref off the url, look up the server-side state we stashed
// before the redirect (keyed by the grant nonce), and continue the grant to get the
// finalized access token.
//
// WIRING NOTE (read me): the nonce links the OUTBOUND redirect to THIS return trip, but
// nothing in the standard callback query string carries our nonce back automatically.
// Part 6 (the UI wire-up) is where the outbound redirect is constructed so the nonce
// rides along (e.g. appended to the finish.uri or held in the user's session), and the
// `requestOutgoingGrant` caller actually calls `saveRedirectState`. Until that exists,
// this handler does the honest, fully-working-given-its-inputs thing:
//   - always parse and surface `interact_ref` (proof of approval), and
//   - IF a nonce is present and we have matching stashed state, finish the grant for real.
// That keeps Part 4 independently testable and lets Part 6 drop in the nonce plumbing.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getOpenPaymentsClient } from '@/lib/payments/client'
import { continueOutgoingGrant } from '@/lib/payments/outgoing-grant'
import { createOutgoingPayment } from '@/lib/payments/outgoing'
import {
  getRedirectState,
  clearRedirectState,
} from '@/lib/payments/redirect-state'

export async function GET(request: NextRequest): Promise<NextResponse> {
  // `request.nextUrl` is the parsed incoming URL. `.searchParams` is its query string,
  // the same API as `new URL(...).searchParams` used in the lib layer.
  const url = request.nextUrl
  const interactRef = url.searchParams.get('interact_ref')

  // The IdP must give us interact_ref on a successful approval. No interact_ref means
  // the user either didn't approve or something went wrong upstream.
  if (!interactRef) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Callback received but 'interact_ref' is missing — the payment was not approved.",
      },
      { status: 400 },
    )
  }

  // How we find the matching stashed state. Part 6 wires the nonce onto the outbound
  // redirect so it returns here; we read it defensively for now.
  const nonce = url.searchParams.get('nonce') ?? undefined
  const state = nonce ? getRedirectState(nonce) : undefined

  // No stashed state yet (e.g. running this part in isolation, or the nonce plumbing
  // isn't wired until Part 6). Return a clear placeholder proving the callback works
  // and that we received the approval reference — but don't pretend we finished a grant.
  if (!state) {
    return NextResponse.json({
      ok: true,
      stage: 'callback-received',
      interactRef,
      message:
        'Callback received and interact_ref captured. Server-side grant state lookup ' +
        'is wired in Part 6 (feat/06-ui-wire-up); once a nonce + stashed state are ' +
        'present, this route will continue the grant automatically.',
    })
  }

  // We have everything — finish the grant for real. The full URL (with interact_ref) is
  // handed to the lib layer, which extracts interact_ref and calls grant.continue.
  const client = await getOpenPaymentsClient()
  const accessToken = await continueOutgoingGrant(
    client,
    state.continueAccessToken,
    state.continueUri,
    url.toString(),
  )

  // --- Part 5 — send the payment ----------------------------------------------------------
  // To actually create the outgoing payment we need two things from the stashed state: the
  // quote id (the locked-in price) and the sender's wallet url (who pays). Part 4 stashes
  // these as OPTIONAL fields, and the full nonce-plumbing that guarantees they're present is
  // wired in Part 6. So we branch honestly: if both are here, send for real and return a
  // receipt; if not, stop at "grant-finalized" exactly as before, without pretending we sent.
  if (state.quoteId && state.senderWalletUrl) {
    const receipt = await createOutgoingPayment(
      client,
      state.senderWalletUrl,
      accessToken,
      state.quoteId,
    )

    // One-time use: drop the stashed state now that the payment is created.
    clearRedirectState(state.nonce)

    // Part 6 — show the Result screen. We carry the receipt to /result IN THE URL (base64url
    // encoded JSON) rather than a server store: the receipt isn't secret (amounts + payment
    // id), and this keeps the result page stateless and refresh-safe. `redirect` needs an
    // absolute URL, so we build it from this request's own origin.
    const encoded = Buffer.from(JSON.stringify(receipt)).toString('base64url')
    const resultUrl = new URL('/result', request.nextUrl.origin)
    resultUrl.searchParams.set('r', encoded)
    return NextResponse.redirect(resultUrl)
  }

  // No quote id / sender wallet stashed yet (Part 4 in isolation, or pre-Part-6 plumbing):
  // the grant is genuinely finalized, we just don't have what we need to send. Drop the
  // state and report the honest stage rather than faking a payment.
  clearRedirectState(state.nonce)

  // We do NOT echo the raw token in a real UI; this is a POC server response, not a page.
  return NextResponse.json({
    ok: true,
    stage: 'grant-finalized',
    interactRef,
    quoteId: state.quoteId ?? null,
    message:
      'Sender approved. Outgoing-payment grant finalized; access token obtained. To send, ' +
      'the stashed state also needs quoteId + senderWalletUrl (wired fully in Part 6).',
    // Length only, never the secret itself — just proof we got a usable token.
    accessTokenLength: accessToken.length,
  })
}
