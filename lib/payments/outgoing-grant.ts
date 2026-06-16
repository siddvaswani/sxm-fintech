// lib/payments/outgoing-grant.ts
//
// PART 4 — "Get the sender's human approval before any money can move."
//
// This is the consent step. Creating an OUTGOING payment (actually spending money)
// is not harmless like creating an incoming-payment slot was in Part 2, so the test
// wallet insists a real human approves it in their browser first. That makes this
// grant INTERACTIVE, and it happens in two halves with a detour through the browser
// in between:
//
//   1. requestOutgoingGrant()  — ask for the grant. The wallet replies "not yet —
//      send your user to THIS url to approve." We hand back that redirect url plus
//      the secret "continue" credentials we'll need afterwards.
//        → browser goes to the test wallet's approval page, user clicks Approve,
//          wallet bounces the browser back to /callback?interact_ref=...&hash=...
//   2. continueOutgoingGrant() — armed with the interact_ref from that redirect and
//      the stashed continue credentials, we tell the wallet "they approved, finish
//      it" and get back the real access token used (in Part 5) to send the payment.
//
// Same two-beat "grant → use it" rhythm as Part 2, just stretched around a redirect.
//
// Custody note: even this approved token only lets us INITIATE a payment within the
// limit the user saw. The test wallets hold and move the actual funds. We never do.

import 'server-only'
import { isPendingGrant, isFinalizedGrantWithAccessToken } from '@interledger/open-payments'
import type { OpenPaymentsClient } from './client'

// --- The amount shape we accept (decoupled from Part 3 on purpose) ----------
// Part 3 builds lib/payments/quote.ts and produces the real `debitAmount` (what the
// sender will be charged). We deliberately DON'T import from quote.ts here so the two
// parts stay independent and merge cleanly. Instead we declare the exact shape we
// need and take it as a plain parameter. This object matches Open Payments' standard
// "Amount" — an integer string of minor units plus its currency code/scale.
// (In Python this `interface` is like a TypedDict describing the dict we expect.)
export interface DebitAmount {
  value: string // integer string in the asset's smallest unit, e.g. "10000"
  assetCode: string // currency code, e.g. "USD"
  assetScale: number // number of decimal places, e.g. 2
}

// What requestOutgoingGrant hands back to the caller (a server route). The route must
// stash `continue` + `nonce` server-side keyed by the nonce, then redirect the user's
// browser to `redirectUrl`. None of this secret state should ever reach the browser.
export interface PendingOutgoingGrant {
  redirectUrl: string // send the user's BROWSER here to approve the payment
  continueAccessToken: string // secret: lets us "continue" the grant after approval
  continueUri: string // the url we POST to when continuing the grant
  nonce: string // ties the returned redirect back to THIS grant request
}

// Where the test wallet sends the browser back to after approval. The spec hardcodes
// http://localhost:3000/callback; we make the base configurable via APP_BASE_URL so it
// still works if the dev server runs elsewhere, but fall back to the spec's default.
// (`??` is "use the right side only if the left is null/undefined" — like Python's
//  `os.environ.get('APP_BASE_URL') or 'http://localhost:3000'`.)
//
// Part 6 wiring: we put the `nonce` ON this callback url (`/callback?nonce=...`). When the
// wallet redirects the browser back it APPENDS its own params (`&interact_ref=...&hash=...`),
// so /callback receives both — the nonce lets it look up the server-side state we stashed,
// and interact_ref lets it finish the grant. Building it with `URL` handles the encoding.
function callbackUri(nonce: string): string {
  const base = process.env.APP_BASE_URL ?? 'http://localhost:3000'
  const url = new URL('/callback', base)
  url.searchParams.set('nonce', nonce)
  return url.toString()
}

/**
 * Beat 1 — request the INTERACTIVE outgoing-payment grant (sender authorization).
 *
 * @param client       The shared authenticated client (from getOpenPaymentsClient()).
 * @param senderWalletUrl  Business A's wallet address URL — the account that will pay.
 * @param debitAmount  The exact amount the sender will be charged, from the Part 3
 *                     quote (passed in, NOT imported). Becomes the grant's spend limit
 *                     so approval can't authorize more than the user was shown.
 *
 * Returns the redirect url (where to send the browser) plus the `continue` credentials
 * and nonce the caller must stash server-side to finish the grant later.
 */
export async function requestOutgoingGrant(
  client: OpenPaymentsClient,
  senderWalletUrl: string,
  debitAmount: DebitAmount,
): Promise<PendingOutgoingGrant> {
  // Resolve the sender wallet → tells us its auth server (where grants are requested)
  // and its canonical id (used as the grant's `identifier`).
  const senderWallet = await client.walletAddress.get({ url: senderWalletUrl })

  // A fresh random nonce per grant. The wallet echoes it back so we can prove the
  // returning browser belongs to THIS grant request. `crypto.randomUUID()` is built
  // into Node — like Python's `uuid.uuid4()`.
  const nonce = crypto.randomUUID()

  // Beat 1 — ask for the grant. Unlike Part 2's silent incoming-payment grant, this
  // one carries an `interact` block, which is what makes the wallet require a human.
  const grant = await client.grant.request(
    { url: senderWallet.authServer },
    {
      access_token: {
        access: [
          {
            identifier: senderWallet.id,
            type: 'outgoing-payment',
            actions: ['list', 'list-all', 'read', 'read-all', 'create'],
            // `limits` caps what this approval can authorize. We pin it to the exact
            // quoted debitAmount so the consent screen and the spend ceiling match.
            limits: { debitAmount },
          },
        ],
      },
      interact: {
        // `start: ['redirect']` = begin approval by sending the browser somewhere.
        start: ['redirect'],
        // `finish` = how the wallet returns control: redirect the browser to our
        // /callback url (which now carries the nonce so we can match it back up).
        finish: {
          method: 'redirect',
          uri: callbackUri(nonce),
          nonce,
        },
      },
    },
  )

  // `isPendingGrant` is a type guard: true only when the grant is awaiting interaction
  // and therefore carries `interact.redirect` + `continue`. An interactive grant should
  // ALWAYS be pending here. If it isn't, the wallet didn't ask for the approval we need.
  // Past this check, TypeScript also knows `grant.interact` and `grant.continue` exist.
  if (!isPendingGrant(grant)) {
    throw new Error(
      'Outgoing-payment grant was not pending; expected an interactive grant requiring approval.',
    )
  }

  return {
    redirectUrl: grant.interact.redirect,
    continueAccessToken: grant.continue.access_token.value,
    continueUri: grant.continue.uri,
    nonce,
  }
}

/**
 * Beat 2 — continue (finish) the grant after the user approves and the browser is
 * redirected back to /callback?interact_ref=...&hash=...
 *
 * @param client       The shared authenticated client.
 * @param continueAccessToken  The stashed secret from requestOutgoingGrant().
 * @param continueUri  The stashed continue url from requestOutgoingGrant().
 * @param returnedUrl  The full url the browser came back on (we read `interact_ref`).
 *
 * Returns the finalized access token value — the credential Part 5 uses to actually
 * create the outgoing payment.
 */
export async function continueOutgoingGrant(
  client: OpenPaymentsClient,
  continueAccessToken: string,
  continueUri: string,
  returnedUrl: string,
): Promise<string> {
  // The test wallet's IdP appends `interact_ref` to the callback url. It's the proof
  // that the user actually approved. `new URL(...).searchParams.get(...)` parses the
  // query string — like Python's urllib.parse. Returns `null` if the param is absent.
  const interactRef = new URL(returnedUrl).searchParams.get('interact_ref')
  if (!interactRef) {
    throw new Error(
      "Missing 'interact_ref' on the callback URL; cannot continue the grant (was the payment approved?).",
    )
  }

  // TODO (hardening): verify the returned `hash` query param per the Open Payments
  // spec before trusting this callback. The official snippet leaves this as a @TODO
  // too; for this POC we accept the interact_ref as-is.

  // Beat 2 — tell the wallet the user approved. We authenticate this with the stashed
  // continue token + url and pass the interact_ref we just extracted.
  const finalized = await client.grant.continue(
    { accessToken: continueAccessToken, url: continueUri },
    { interact_ref: interactRef },
  )

  // Final guard: a finalized grant that actually carries a usable access token. If the
  // user denied (or it's somehow still pending), this is false and we stop here. Past
  // this check TypeScript knows `finalized.access_token` is present.
  if (!isFinalizedGrantWithAccessToken(finalized)) {
    throw new Error(
      'Grant did not finalize with an access token; the sender may have declined the payment.',
    )
  }

  return finalized.access_token.value
}
