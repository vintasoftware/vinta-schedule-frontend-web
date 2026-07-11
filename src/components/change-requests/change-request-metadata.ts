/**
 * Display metadata for external-event change requests: human labels for the
 * status / kind / provider enums, the Badge variant per status, and a helper
 * to normalise the loosely-typed proposed_values / retained_values payloads.
 */

import type {
  ExternalEventChangeRequestStatusEnum,
  KindEnum,
  ProviderEnum,
} from '@/client';
import type { BadgeProps } from '@vinta-schedule/design-system/ui/badge';

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export const STATUS_LABELS: Record<
  ExternalEventChangeRequestStatusEnum,
  string
> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  stale: 'Stale',
  auto_undone: 'Auto-undone',
};

export const STATUS_BADGE_VARIANTS: Record<
  ExternalEventChangeRequestStatusEnum,
  NonNullable<BadgeProps['variant']>
> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  stale: 'secondary',
  auto_undone: 'secondary',
};

/** Statuses offered in the status filter, in display order. */
export const STATUS_FILTER_OPTIONS: ExternalEventChangeRequestStatusEnum[] = [
  'pending',
  'approved',
  'rejected',
  'stale',
  'auto_undone',
];

// ---------------------------------------------------------------------------
// Kind
// ---------------------------------------------------------------------------

export const KIND_LABELS: Record<KindEnum, string> = {
  update: 'Update',
  delete: 'Delete',
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const PROVIDER_LABELS: Record<ProviderEnum, string> = {
  internal: 'Internal',
  google: 'Google',
  microsoft: 'Microsoft',
  apple: 'Apple',
  ics: 'ICS',
};

// ---------------------------------------------------------------------------
// proposed_values / retained_values
//
// The schema documents these as { title, description, start_time, end_time }
// but types them as `unknown`. We coerce to a known shape for display while
// tolerating missing / extra keys.
// ---------------------------------------------------------------------------

export interface ChangeRequestValues {
  title?: string | null;
  description?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

/** The fields we surface in the detail view, in display order. */
export const VALUE_FIELDS: { key: keyof ChangeRequestValues; label: string }[] =
  [
    { key: 'title', label: 'Title' },
    { key: 'description', label: 'Description' },
    { key: 'start_time', label: 'Start' },
    { key: 'end_time', label: 'End' },
  ];

/** Narrow an `unknown` payload to ChangeRequestValues; '{}' when not an object. */
export function asChangeRequestValues(value: unknown): ChangeRequestValues {
  if (value && typeof value === 'object') {
    return value as ChangeRequestValues;
  }
  return {};
}
