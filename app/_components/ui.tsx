// app/_components/ui.tsx
//
// Shared, presentational building blocks for the three screens. No React hooks
// here, so this file works inside BOTH the client page (app/page.tsx) and the
// server component (app/result/page.tsx). Keeping the shell, stepper, and money
// figure in one place is what makes the vocabulary identical screen to screen.

import type { ReactNode } from 'react'

// The four beats of the flow. The active one is highlighted; earlier ones read
// as done. Index is 0-based.
export const STEPS = ['Amount', 'Review', 'Approve', 'Receipt'] as const

/** A small live dot + label, e.g. the "testnet" status in the header. */
export function StatusDot({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-wider text-muted">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
      {label}
    </span>
  )
}

/** The four-step progress rail. `current` is the active STEPS index. */
export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Payment progress">
      {STEPS.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo'
        return (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <span
              className={[
                'h-0.5 w-full rounded-full transition-colors duration-300',
                state === 'active'
                  ? 'bg-accent'
                  : state === 'done'
                    ? 'bg-accent/45'
                    : 'bg-line',
              ].join(' ')}
            />
            <span
              className={[
                'text-[0.625rem] font-medium uppercase tracking-wider transition-colors duration-300',
                state === 'active'
                  ? 'text-ink'
                  : state === 'done'
                    ? 'text-muted'
                    : 'text-faint',
              ].join(' ')}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * A money figure: big tabular-mono number + a smaller currency code. Tabular
 * digits mean amounts never shift width between rows — the ledger stays aligned.
 */
export function Figure({
  value,
  code,
  size = 'md',
  tone = 'ink',
}: {
  value: string
  code: string
  size?: 'md' | 'lg'
  tone?: 'ink' | 'muted' | 'success'
}) {
  const toneClass =
    tone === 'success' ? 'text-success' : tone === 'muted' ? 'text-muted' : 'text-ink'
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span
        className={[
          'tnum font-semibold tracking-tight tabular-nums',
          size === 'lg' ? 'text-2xl' : 'text-base',
          toneClass,
        ].join(' ')}
      >
        {value}
      </span>
      <span className="tnum text-[0.6875rem] font-medium uppercase tracking-wide text-faint">
        {code}
      </span>
    </span>
  )
}

/** One label→value row in a ledger block. */
export function Row({
  label,
  children,
  divider = false,
}: {
  label: string
  children: ReactNode
  divider?: boolean
}) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-4 py-2.5',
        divider ? 'border-t border-line' : '',
      ].join(' ')}
    >
      <dt className="text-[0.8125rem] text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

/**
 * The page frame: centered instrument-panel card with a brand header, the step
 * rail, the screen's content, and the honest footer note. `step` drives the rail.
 */
export function Shell({
  step,
  children,
}: {
  step: number
  children: ReactNode
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-line bg-surface shadow-[inset_0_1px_0_0_oklch(1_0_0/0.04),0_28px_70px_-30px_oklch(0_0_0/0.75)]">
          {/* Header: protocol tag + live status */}
          <div className="flex items-center justify-between px-6 pt-5">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rotate-45 rounded-[3px] bg-accent" aria-hidden />
              <span className="tnum text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-muted">
                Open Payments
              </span>
            </span>
            <StatusDot label="testnet" />
          </div>

          {/* Step rail */}
          <div className="px-6 pt-5">
            <Stepper current={step} />
          </div>

          <div className="mt-5 h-px w-full bg-line" />

          {/* Screen content */}
          <div className="px-6 py-6">{children}</div>
        </div>

        {/* Honest footer — the non-custodial claim is the pitch, so state it plainly. */}
        <p className="mt-4 text-center text-[0.75rem] leading-relaxed text-faint">
          Test money on the Interledger test wallet.
          <br className="sm:hidden" /> The platform routes the payment and never holds funds.
        </p>
      </div>
    </main>
  )
}

/** Primary / secondary button styles shared by every screen. */
export const btnPrimary =
  'focusable inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-ink transition-[background-color,transform,opacity] duration-150 hover:bg-accent-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45'

export const btnGhost =
  'focusable inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-[0.8125rem] font-medium text-muted transition-colors duration-150 hover:text-ink disabled:opacity-45'
