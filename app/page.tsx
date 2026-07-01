// app/page.tsx
//
// PART 6 — Screens 1 & 2: "Start" and "Review quote".
//
// `'use client'` marks this as a CLIENT component — it runs in the browser and can hold
// state and respond to clicks (a plain server component can't). We keep both screens in one
// component because the quote we fetch for the Review step lives in React state; there's no
// need for a separate page or another server round-trip to move between them.
//
// Flow this component drives:
//   Start  — enter how much Business B receives → POST /api/quote → get the price
//   Review — show what A pays, what B gets, the rate + fee → POST /api/send → go approve
// After approval the wallet returns the browser to /callback, which finishes the payment
// and redirects to /result (the third screen, a separate server component).

'use client'

import { useState } from 'react'
import type { QuoteResult } from '@/lib/payments/quote'
import { Shell, Figure, Row, btnPrimary, btnGhost } from '@/app/_components/ui'

// Which screen we're showing. A small string union is TypeScript's version of an enum.
type Step = 'start' | 'review'

export default function Home() {
  const [step, setStep] = useState<Step>('start')
  const [amount, setAmount] = useState('') // what B receives, in B's currency (a string)
  const [quote, setQuote] = useState<QuoteResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Screen 1 action — ask the server for a quote, then switch to the Review screen.
  async function getQuote() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message ?? 'Could not get a quote.')
      setQuote(data.quote as QuoteResult)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get a quote.')
    } finally {
      setLoading(false)
    }
  }

  // Screen 2 action — confirm. Ask the server to start the approval, then send the BROWSER
  // to the wallet's approval page (that's what `window.location.href = ...` does).
  async function confirmAndSend() {
    if (!quote) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: quote.id, debitAmount: quote.debitAmount }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message ?? 'Could not start the payment.')
      window.location.href = data.redirectUrl as string // leave the app → wallet approval
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the payment.')
      setLoading(false) // only reset on error; on success we're navigating away
    }
  }

  return (
    <Shell step={step === 'start' ? 0 : 1}>
      {/* The two parties, stated once so the whole flow reads as A → B. */}
      <div className="flex items-center gap-3 text-[0.8125rem]">
        <div className="flex flex-col">
          <span className="font-medium text-ink">Business A</span>
          <span className="text-[0.6875rem] uppercase tracking-wide text-faint">Sender</span>
        </div>
        <div className="h-px flex-1 bg-line" />
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="text-accent">
          <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="h-px flex-1 bg-line" />
        <div className="flex flex-col text-right">
          <span className="font-medium text-ink">Business B</span>
          <span className="text-[0.6875rem] uppercase tracking-wide text-faint">Receiver</span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-xl bg-danger-dim px-3.5 py-2.5 text-[0.8125rem] text-danger"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-0.5 shrink-0">
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {step === 'start' && (
        <div key="start" className="animate-in mt-6">
          <h1 className="text-xl font-semibold tracking-tight text-ink text-balance">
            Send a cross-border payment
          </h1>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
            Enter what Business B should receive. You&apos;ll see the exact cost, rate, and fee
            before you confirm.
          </p>

          <label
            htmlFor="amount"
            className="mt-6 block text-[0.6875rem] font-medium uppercase tracking-wider text-muted"
          >
            Amount Business B receives
          </label>
          <div className="relative mt-2">
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && amount && !loading) getQuote()
              }}
              placeholder="0.00"
              className="focusable tnum w-full rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-2xl font-semibold tabular-nums text-ink placeholder:text-faint"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[0.6875rem] uppercase tracking-wide text-faint">
              B&apos;s currency
            </span>
          </div>

          <button onClick={getQuote} disabled={loading || !amount} className={`${btnPrimary} mt-5`}>
            {loading ? (
              <>
                <Spinner /> Getting quote
              </>
            ) : (
              'Get quote'
            )}
          </button>
        </div>
      )}

      {step === 'review' && quote && (
        <div key="review" className="animate-in mt-6">
          <h1 className="text-xl font-semibold tracking-tight text-ink text-balance">
            Review the quote
          </h1>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
            These are the real figures from the network, locked before you approve.
          </p>

          <dl className="mt-5 rounded-xl border border-line bg-surface-2 px-4 py-1.5">
            <Row label="You send">
              <Figure value={quote.display.debit} code={quote.debitAmount.assetCode} size="lg" />
            </Row>
            <Row label="Business B receives">
              <Figure value={quote.display.receive} code={quote.receiveAmount.assetCode} size="lg" />
            </Row>
            <Row label="Exchange rate" divider>
              <span className="tnum text-[0.8125rem] text-muted">
                1 {quote.debitAmount.assetCode} = {quote.display.exchangeRate}{' '}
                {quote.receiveAmount.assetCode}
              </span>
            </Row>
            <Row label="Network fee">
              <Figure value={quote.display.feeValue} code={quote.debitAmount.assetCode} tone="muted" />
            </Row>
          </dl>

          <button onClick={confirmAndSend} disabled={loading} className={`${btnPrimary} mt-5`}>
            {loading ? (
              <>
                <Spinner /> Redirecting to approve
              </>
            ) : (
              <>
                Confirm &amp; send
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
          <button
            onClick={() => {
              setStep('start')
              setError(null)
            }}
            disabled={loading}
            className={`${btnGhost} mt-1.5`}
          >
            Back
          </button>
        </div>
      )}
    </Shell>
  )
}

// Inline loading spinner for button states. Pure CSS spin; respects reduced-motion
// via the global rule that neutralizes transition/animation durations.
function Spinner() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden className="animate-spin">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.75" className="opacity-25" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}
