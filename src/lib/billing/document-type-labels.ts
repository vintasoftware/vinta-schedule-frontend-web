/**
 * document-type-labels.ts — human-facing labels for the nine
 * `BillingProfileDocumentTypeEnum` values the billing profile form's
 * `document_type` select is constrained to on write.
 *
 * Mirrors `resource-labels.ts` / `entitlement-labels.ts`: the mapping lives
 * here once. Unlike those two, this set is closed (the write control only
 * offers these nine values — see the "document_type closed on write, open on
 * read" decision in the billing-hardening plan), so there is no
 * humanized-fallback branch here; the read view renders a legacy/out-of-enum
 * value verbatim instead of going through this map.
 */

import type { BillingProfileDocumentTypeEnum } from '@/client';

export const DOCUMENT_TYPE_LABELS: Record<
  BillingProfileDocumentTypeEnum,
  string
> = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  DNI: 'DNI',
  CI: 'CI',
  RUT: 'RUT',
  SSN: 'SSN (US)',
  EIN: 'EIN',
  PASSPORT: 'Passport',
  OTHER: 'Other',
};

/** The nine document-type enum values, in select-menu display order. */
export const DOCUMENT_TYPE_OPTIONS: {
  value: BillingProfileDocumentTypeEnum;
  label: string;
}[] = (
  Object.keys(DOCUMENT_TYPE_LABELS) as BillingProfileDocumentTypeEnum[]
).map((value) => ({ value, label: DOCUMENT_TYPE_LABELS[value] }));
