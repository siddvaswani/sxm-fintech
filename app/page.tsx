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
    <main className="flex flex-1 items-center justify-center bg-zinc-50 p-6 dark:bg-black">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
          Cross-border payment
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Business A pays Business B
        </h1>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {step === 'start' && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Amount Business B receives
              <span className="ml-1 font-normal text-zinc-400">(in B&apos;s currency)</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10.00"
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-lg text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-100"
            />
            <button
              onClick={getQuote}
              disabled={loading || !amount}
              className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? 'Getting quote…' : 'Get quote'}
            </button>
          </div>
        )}

        {step === 'review' && quote && (
          <div className="mt-6">
            {/* The FX moment: real numbers from the quote, shown before the user commits. */}
            <dl className="space-y-3 rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <dt className="text-zinc-500">You send</dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {quote.display.debit} {quote.debitAmount.assetCode}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-500">Business B receives</dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {quote.display.receive} {quote.receiveAmount.assetCode}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <dt className="text-zinc-500">Exchange rate</dt>
                <dd className="text-zinc-700 dark:text-zinc-300">
                  1 {quote.debitAmount.assetCode} = {quote.display.exchangeRate}{' '}
                  {quote.receiveAmount.assetCode}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-500">Fee</dt>
                <dd className="text-zinc-700 dark:text-zinc-300">
                  {quote.display.feeValue} {quote.debitAmount.assetCode}
                </dd>
              </div>
            </dl>

            <button
              onClick={confirmAndSend}
              disabled={loading}
              className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? 'Redirecting to approve…' : 'Confirm & Send'}
            </button>
            <button
              onClick={() => {
                setStep('start')
                setError(null)
              }}
              disabled={loading}
              className="mt-2 w-full rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 disabled:opacity-50 dark:hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-zinc-400">
          Test money only · Interledger test wallet · the platform never holds funds
        </p>
      </div>
    </main>
  )
}
