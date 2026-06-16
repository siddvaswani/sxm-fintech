// app/result/page.tsx
//
// PART 6 — Screen 3: "Result" (the receipt).
//
// This is a SERVER component (no 'use client'), so it runs on the server when the browser
// lands on /result. /callback sent the user here after creating the payment, carrying the
// receipt as base64url JSON in the `?r=` query param. We decode it and render it. Nothing
// secret is in the receipt (amounts + the public payment id), and keeping it in the URL means
// this page holds no state and survives a refresh.
//
// In Next.js 16 a page's `searchParams` is a Promise, so the function is `async` and we
// `await` it (like awaiting a coroutine in Python).

import Link from 'next/link'
import type { PaymentReceipt } from '@/lib/payments/outgoing'

// Decode the receipt from the URL. Returns null if it's missing or malformed (e.g. someone
// opened /result directly) so we can show a friendly fallback instead of crashing.
function decodeReceipt(r: string | undefined): PaymentReceipt | null {
  if (!r) return null
  try {
    return JSON.parse(Buffer.from(r, 'base64url').toString()) as PaymentReceipt
  } catch {
    return null
  }
}

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>
}) {
  const { r } = await searchParams
  const receipt = decodeReceipt(r)

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 p-6 dark:bg-black">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {!receipt ? (
          // No (or bad) receipt — e.g. the page was opened directly. Offer a way back.
          <>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              No receipt to show
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              This page shows the result of a payment. Start one from the home screen.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Start a payment
            </Link>
          </>
        ) : (
          <>
            <div className="text-3xl">{receipt.failed ? '❌' : '✅'}</div>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {receipt.failed ? 'Payment failed' : 'Payment sent'}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {receipt.failed
                ? 'The wallet marked this outgoing payment as failed.'
                : 'Business A’s wallet created the outgoing payment and the funds are settling.'}
            </p>

            <dl className="mt-6 space-y-3 rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <dt className="text-zinc-500">Business A paid</dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {receipt.display.debit} {receipt.debitAmount.assetCode}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-500">Business B receives</dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {receipt.display.receive} {receipt.receiveAmount.assetCode}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-500">Settled so far</dt>
                <dd className="text-zinc-700 dark:text-zinc-300">
                  {receipt.display.sent} {receipt.sentAmount.assetCode}
                </dd>
              </div>
            </dl>

            {/* The canonical proof the payment exists. `break-all` keeps the long URL tidy. */}
            <p className="mt-4 text-xs text-zinc-400">Outgoing payment ID</p>
            <p className="break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
              {receipt.id}
            </p>

            <Link
              href="/"
              className="mt-6 inline-block rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Make another payment
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
