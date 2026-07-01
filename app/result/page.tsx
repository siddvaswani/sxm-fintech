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
import { Shell, Figure, Row, btnPrimary } from '@/app/_components/ui'

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

  // Empty state — page opened directly, or the receipt was malformed. Teach the interface
  // rather than showing a bare error.
  if (!receipt) {
    return (
      <Shell step={0}>
        <div className="animate-in mt-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-2 text-faint">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M5 7h10M5 11h10M5 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <rect x="3.25" y="3.25" width="13.5" height="13.5" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">No receipt yet</h1>
          <p className="mx-auto mt-1.5 max-w-xs text-[0.8125rem] leading-relaxed text-muted">
            This screen shows the result of a payment. Start one to see the receipt here.
          </p>
          <Link href="/" className={`${btnPrimary} mt-6`}>
            Start a payment
          </Link>
        </div>
      </Shell>
    )
  }

  const failed = receipt.failed

  return (
    <Shell step={3}>
      <div className="animate-in mt-6">
        {/* Status crest — icon + word, so color is never the only signal. */}
        <div className="flex flex-col items-center text-center">
          <div
            className={[
              'flex h-12 w-12 items-center justify-center rounded-full',
              failed ? 'bg-danger-dim text-danger' : 'bg-success-dim text-success',
            ].join(' ')}
          >
            {failed ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <h1 className="mt-3.5 text-xl font-semibold tracking-tight text-ink">
            {failed ? 'Payment failed' : 'Payment sent'}
          </h1>
          <p className="mt-1.5 max-w-xs text-[0.8125rem] leading-relaxed text-muted">
            {failed
              ? 'The wallet marked this outgoing payment as failed.'
              : 'Business A’s wallet created the outgoing payment. Funds are settling on the network.'}
          </p>
        </div>

        <dl className="mt-6 rounded-xl border border-line bg-surface-2 px-4 py-1.5">
          <Row label="Business A paid">
            <Figure value={receipt.display.debit} code={receipt.debitAmount.assetCode} size="lg" />
          </Row>
          <Row label="Business B receives">
            <Figure value={receipt.display.receive} code={receipt.receiveAmount.assetCode} size="lg" />
          </Row>
          <Row label="Settled so far" divider>
            <Figure
              value={receipt.display.sent}
              code={receipt.sentAmount.assetCode}
              tone={failed ? 'muted' : 'success'}
            />
          </Row>
        </dl>

        {/* Canonical proof the payment exists — the on-network payment id. */}
        <div className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-3">
          <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-faint">
            Outgoing payment ID
          </p>
          <p className="tnum mt-1 break-all text-[0.75rem] leading-relaxed text-muted">
            {receipt.id}
          </p>
        </div>

        <Link href="/" className={`${btnPrimary} mt-6`}>
          Make another payment
        </Link>
      </div>
    </Shell>
  )
}
