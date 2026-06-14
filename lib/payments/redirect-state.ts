// lib/payments/redirect-state.ts
//
// PART 4 — the ONE bit of state in this whole app.
//
// The interactive grant flow has a detour: we ask for a grant, send the user's browser
// off to the test wallet to approve, and the browser comes back to /callback. To finish
// the grant we need things we created BEFORE the detour — the `continue` credentials,
// the nonce, the quote id, the sender wallet. The browser must never carry these
// (they're secrets / spend authority), so we stash them SERVER-SIDE, keyed by the nonce.
//
// For this POC an in-memory Map is plenty (the spec explicitly allows "in-memory keyed
// by nonce"). It does NOT survive a server restart and is single-process only — fine for
// a local demo, not for production. A real deployment would use a signed cookie or a
// short-lived store. This is intentionally the app's only persistence.
//
// (A `Map` is JS's dictionary type — like a Python dict, but it keeps insertion order
//  and lets any value type be a key. Here keys are the nonce strings.)

import 'server-only'

// The shape of what we stash before the redirect. `quoteId` and `senderWalletUrl` are
// here because the spec says the cross-redirect state is quote.id + grant.continue.* +
// sender wallet. Part 5/6 will read these when finishing the payment; for now they're
// optional so this part can stash whatever it has.
export interface RedirectState {
  continueAccessToken: string // secret continue token from requestOutgoingGrant()
  continueUri: string // continue url from requestOutgoingGrant()
  nonce: string // the key, also kept here for convenience
  quoteId?: string // Part 3's quote id (wired up fully in Part 5/6)
  senderWalletUrl?: string // Business A's wallet address (needed to send in Part 5)
}

// Module-level Map = lives for the life of the server process. `const` because we never
// reassign the Map itself, only mutate its contents.
const store = new Map<string, RedirectState>()

/** Stash state before redirecting the browser. Keyed by the grant's nonce. */
export function saveRedirectState(state: RedirectState): void {
  store.set(state.nonce, state)
}

/** Look state back up when the browser returns to /callback. `undefined` if unknown. */
export function getRedirectState(nonce: string): RedirectState | undefined {
  return store.get(nonce)
}

/** Drop the state once the grant is finished (one-time use; don't let it linger). */
export function clearRedirectState(nonce: string): void {
  store.delete(nonce)
}
