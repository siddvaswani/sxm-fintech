# Product

## Register

product

## Users

Grant reviewers and payments-savvy technical evaluators (Interledger Foundation / Open
Payments accelerator). Secondary: the SME operator persona the POC represents — a Sint
Maarten business paying an overseas supplier. Viewers are in an *evaluation* task: judge
whether this is a credible, real settlement flow, not a mockup.

## Product Purpose

A three-screen proof of concept that initiates one real cross-border B2B payment over Open
Payments (Interledger test wallet): enter amount → review the exact FX + fee → approve at
the wallet → receipt. The interface must make an honest, non-custodial payment flow read as
trustworthy and engineered. Success = a reviewer trusts the flow at a glance.

## Brand Personality

Precise, quietly technical, honest. Instrument-panel, not marketing. Three words:
**exact, credible, understated.**

## Anti-references

- Generic zinc/black default-Tailwind card (what it was).
- The navy-and-gold fintech cliché.
- Crypto-app maximalism (glows everywhere, gradient text, hype copy).
- Hero-metric SaaS template; eyebrow-on-every-section scaffolding.

## Design Principles

1. **The numbers are the product.** Money, rates, and IDs render in tabular mono, decimal-
   aligned, so figures read like a ledger and never shift.
2. **Show the flow honestly.** A→B, testnet, non-custodial, and the exact fee/rate are stated
   plainly before confirm — the transparency is the pitch.
3. **State over decoration.** Every interactive element has default/hover/focus/active/
   disabled/loading/error. Motion conveys state changes only.
4. **Earned familiarity.** Standard affordances; the tool disappears into the task.

## Accessibility & Inclusion

WCAG AA: body text ≥4.5:1 on its surface, visible focus rings, `prefers-reduced-motion`
honored on every transition. Semantic status color never the sole signal (icon + word too).

## Visual direction (chosen 2026-07-01)

**Technical precision (dark).** Deep ink surfaces, near-white ink, one restrained teal accent
for interactive/primary + focus; green reserved for settlement success, red for failure.
Geist Sans for UI, Geist Mono (tabular-nums) for all figures.
