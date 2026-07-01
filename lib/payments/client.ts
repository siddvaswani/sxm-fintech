// lib/payments/client.ts
//
// THE ONLY PLACE that creates the Open Payments client and touches credentials.
// Everything else in lib/payments/ asks this module for a ready-to-use client.
//
// Custody note: this client is just an authenticated *caller*. It signs requests
// to the test wallets (the "banks"). It never holds a balance. Keep it that way.

// `server-only` makes the build FAIL if this file is ever imported into browser
// code. That guarantees our private key can never leak to the client side.
// (In Python you'd rely on convention; here the compiler enforces it.)
import 'server-only'

import { createAuthenticatedClient } from '@interledger/open-payments'

// --- A note on types (you're coming from Python) ---------------------------
// TypeScript checks types at compile time. The SDK doesn't export a tidy name
// for "the client object", so we DERIVE its type from the function itself:
//   ReturnType<typeof createAuthenticatedClient>  -> Promise<TheClient>
//   Awaited<...>                                  -> TheClient (unwraps the Promise)
// Now `OpenPaymentsClient` always matches the SDK, even if the SDK changes.
export type OpenPaymentsClient = Awaited<
  ReturnType<typeof createAuthenticatedClient>
>

// Read one required environment variable, or fail loudly with a helpful message.
// process.env values are `string | undefined`; after this check TypeScript knows
// the result is a plain `string`, so callers don't have to handle `undefined`.
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env and fill it in (see README.md).`,
    )
  }
  return value
}

// We only ever want ONE client per server process, so we cache the Promise the
// first time it's requested and reuse it afterwards. (`let ... | undefined` is
// roughly a module-level variable that starts unset.)
let clientPromise: Promise<OpenPaymentsClient> | undefined

/**
 * Get the shared, authenticated Open Payments client.
 *
 * It's async because creating the client reads the private key and fetches the
 * platform wallet's keys over the network. Call it like:
 *   const client = await getOpenPaymentsClient()
 */
export function getOpenPaymentsClient(): Promise<OpenPaymentsClient> {
  if (!clientPromise) {
    clientPromise = createAuthenticatedClient({
      // The platform's own wallet address — its Open Payments identity.
      walletAddressUrl: requireEnv('CLIENT_WALLET_ADDRESS'),
      // Path to the downloaded private.key file (the SDK reads the file for us).
      privateKey: requireEnv('PRIVATE_KEY_PATH'),
      // The key id that pairs with that private key in the test wallet.
      keyId: requireEnv('KEY_ID'),
    })
  }
  return clientPromise
}
