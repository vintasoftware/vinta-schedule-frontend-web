/**
 * format.ts — money + period display helpers for the billing surface.
 *
 * The API hands money as `DecimalField` strings (e.g. "12.5000") paired with a
 * `currency` from the plan snapshot, and period bounds as ISO datetimes. The UI
 * formats at the edge from those API-provided values — never hard-coding a `$`
 * or doing client-side money arithmetic (Guiding Decision: "Money and dates are
 * formatted at the edge, from API-provided currency/timezone").
 */

/**
 * Formats a Decimal-string amount in the given ISO-4217 currency using the
 * viewer's locale, via `Intl.NumberFormat`. The currency drives the symbol and
 * the fraction digits — no symbol is ever hard-coded.
 *
 * `amount` is parsed with `Number`; a Decimal string like "12.5000" is a valid
 * JS number literal, and display precision is the currency's own (e.g. 2 for
 * USD), so the trailing zeros the API carries for storage precision do not leak
 * into the rendered value. A non-numeric amount falls back to the raw string
 * with the currency code, rather than rendering "NaN".
 */
export function formatMoney(
  amount: string,
  currency: string,
  locale?: string
): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return `${amount} ${currency}`;
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Formats an ISO datetime as a locale date-time string. Used for billing
 * period bounds. An unparseable input falls back to the raw string rather than
 * "Invalid Date".
 */
export function formatPeriod(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * The sentinel a statement's per-resource `total` renders as when the metric
 * was never captured for that period. `null` means "not recorded" — never `0`
 * (Guiding Decision + API field description: forward-only history distinguishes
 * "no data" from "zero usage").
 */
export const NOT_RECORDED_LABEL = 'Not recorded';

/**
 * Renders a nullable resource total for display:
 * - `null` → the string "Not recorded" (the metric was never captured), NEVER "0".
 * - a number → its string form, so `0` renders as "0" and is visibly distinct
 *   from "Not recorded".
 */
export function formatResourceTotal(total: number | null): string {
  if (total === null) {
    return NOT_RECORDED_LABEL;
  }
  return String(total);
}
