// lib/payments/amounts.ts
//
// Pure helpers for converting between human amounts and Open Payments "minor units".
//
// Open Payments expresses EVERY amount as an integer string in the asset's smallest
// unit, paired with an `assetScale` (number of decimal places). Examples:
//   $10.00  (USD, scale 2)  ->  { value: "1000", assetScale: 2 }
//   180 XCG (scale 2)       ->  { value: "18000", assetScale: 2 }
//
// There is NO `import 'server-only'` here on purpose: this is just math with no
// secrets, so it's safe to use on the server or in the browser (handy for the UI later).
//
// We convert via strings, not floating-point, because 0.1 + 0.2 !== 0.3 in JS (and
// in Python) — money math must never touch floats.

/**
 * Human amount -> integer string of minor units.
 *   toMinorUnits("180", 2)    -> "18000"
 *   toMinorUnits("10.00", 2)  -> "1000"
 *   toMinorUnits("0.18", 2)   -> "18"
 */
export function toMinorUnits(amount: string | number, assetScale: number): string {
  const [whole, fractionRaw = ''] = String(amount).split('.')
  // Pad or trim the fractional part to exactly `assetScale` digits.
  const fraction = fractionRaw.padEnd(assetScale, '0').slice(0, assetScale)
  // Glue whole+fraction, then drop any leading zeros (but keep a single 0).
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, '')
  return digits === '' ? '0' : digits
}

/**
 * Integer string of minor units -> human decimal string (for display).
 *   fromMinorUnits("1000", 2)  -> "10.00"
 *   fromMinorUnits("18", 2)    -> "0.18"
 *   fromMinorUnits("500", 0)   -> "500"
 */
export function fromMinorUnits(value: string, assetScale: number): string {
  if (assetScale === 0) return value
  const negative = value.startsWith('-')
  const raw = negative ? value.slice(1) : value
  // Ensure there are enough digits to slot in the decimal point.
  const digits = raw.padStart(assetScale + 1, '0')
  const whole = digits.slice(0, -assetScale)
  const fraction = digits.slice(-assetScale)
  return `${negative ? '-' : ''}${whole}.${fraction}`
}
