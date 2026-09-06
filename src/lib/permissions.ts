// ---------------------------------------------------------------------------
// Organization membership capabilities.
//
// Framework-free (no 'use client', no React) so it stays importable from a
// Server Component and from pure predicate modules like
// `components/appointment-types/appointment-type-permissions.ts`. The React context and
// gating hooks that consume these live in
// `components/navigation/permission-gate.tsx`, which re-exports everything
// here so existing call sites keep a single import.
//
// These are `<app_label>.<codename>` strings — the same strings the server
// enforces authorization on, so gating UI on one cannot disagree with the
// server. The set grows over time: treat an unrecognised string as an unknown
// capability, not an error, and never reconstruct a "role" from the list —
// gate each piece of UI on the specific capability it needs.
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
  /** Invite, deactivate, reactivate and re-group members. The old "admin". */
  manageMembers: 'organizations.manage_members',
  /** Change the organization's own settings. */
  manageOrganization: 'organizations.manage_organization',
  /** Permission half of the white-label branding gate (see `can_manage_branding`). */
  manageBranding: 'organizations.manage_branding',
  /** Change the plan, buy add-ons, manage the payment method, cancel. */
  manageBilling: 'payments.manage_billing',
} as const;

// ---------------------------------------------------------------------------
// membershipLabel — a short, human-readable badge for a member's standing,
// derived from capabilities. Not authorization: purely a display convenience
// for the org switcher and member table. A member with `manage_members` reads
// as "Admin"; one with only `manage_billing` as "Billing"; anyone else (empty
// or unresolved) as "Member".
// ---------------------------------------------------------------------------

export function membershipLabel(
  permissions: readonly string[] | null | undefined
): 'Admin' | 'Billing' | 'Member' {
  const perms = permissions ?? [];
  if (perms.includes(PERMISSIONS.manageMembers)) return 'Admin';
  if (perms.includes(PERMISSIONS.manageBilling)) return 'Billing';
  return 'Member';
}
