/**
 * Booking-policy target helpers.
 *
 * A BookingPolicy attaches to exactly one target. In the API that is expressed
 * as one of four mutually exclusive fields; in the UI we model it as a single
 * discriminant (`BookingPolicyTargetType`) plus, for the entity-scoped types,
 * the referenced entity id.
 *
 *   'calendar'              → calendar (single, resource, or bundle calendar)
 *   'calendar_group'        → calendar_group
 *   'membership'            → membership_user_id
 *   'organization_default'  → is_organization_default = true
 */

import type { BookingPolicy, BookingPolicyWritable } from '@/client';

export type BookingPolicyTargetType =
  | 'calendar'
  | 'calendar_group'
  | 'membership'
  | 'organization_default';

export const TARGET_TYPE_OPTIONS: {
  value: BookingPolicyTargetType;
  label: string;
  description: string;
}[] = [
  {
    value: 'calendar',
    label: 'Calendar',
    description:
      'A single calendar — personal, resource, or a bundle calendar (auto-expanded to its children).',
  },
  {
    value: 'calendar_group',
    label: 'Calendar group',
    description: 'A role-based group that pools several calendars into slots.',
  },
  {
    value: 'membership',
    label: 'Member',
    description:
      'An org member — applies to calendars they own that have no calendar-level policy.',
  },
  {
    value: 'organization_default',
    label: 'Organization default',
    description:
      'The org-wide fallback used when no more specific policy resolves. At most one.',
  },
];

/** The three target types that reference an entity id (everything but the org default). */
export function targetTypeNeedsEntity(type: BookingPolicyTargetType): boolean {
  return type !== 'organization_default';
}

/** Derive the target discriminant from an existing policy record. */
export function getTargetType(policy: BookingPolicy): BookingPolicyTargetType {
  if (policy.calendar != null) return 'calendar';
  if (policy.calendar_group != null) return 'calendar_group';
  if (policy.membership_user_id != null) return 'membership';
  return 'organization_default';
}

/** The referenced entity id for entity-scoped targets, else null. */
export function getTargetEntityId(policy: BookingPolicy): number | null {
  return (
    policy.calendar ??
    policy.calendar_group ??
    policy.membership_user_id ??
    null
  );
}

/**
 * Build the exactly-one-target fields for a create body from the UI selection.
 * Only the chosen field is set so the backend's exactly-one-target rule holds.
 */
export function buildTargetFields(
  type: BookingPolicyTargetType,
  entityId: number | null
): Pick<
  BookingPolicyWritable,
  | 'calendar'
  | 'calendar_group'
  | 'membership_user_id'
  | 'is_organization_default'
> {
  switch (type) {
    case 'calendar':
      return { calendar: entityId };
    case 'calendar_group':
      return { calendar_group: entityId };
    case 'membership':
      return { membership_user_id: entityId };
    case 'organization_default':
      return { is_organization_default: true };
  }
}

export function targetTypeLabel(type: BookingPolicyTargetType): string {
  return (
    TARGET_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? String(type)
  );
}
