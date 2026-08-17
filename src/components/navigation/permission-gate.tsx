'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The capability constants and the display helper live in a framework-free
// module (importable from Server Components and pure predicates); re-exported
// here so gating call sites keep a single import next to the hooks.
export { PERMISSIONS, membershipLabel } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Permission context — exposes the current member's resolved capabilities to
// any component in the (app) route group. Set once by the AppLayout
// (app-layout-client.tsx); consumed by PermissionGate and useRequirePermission.
//
// `null` means "not yet resolved" (loading, or the user has no membership).
// An empty array is a valid, normal value — a member with no elevated
// capabilities. Distinguishing the two matters for redirect gates.
// ---------------------------------------------------------------------------

interface PermissionContextValue {
  permissions: readonly string[] | null;
}

const PermissionContext = React.createContext<PermissionContextValue>({
  permissions: null,
});

export function PermissionProvider({
  permissions,
  children,
}: {
  permissions: readonly string[] | null;
  children: React.ReactNode;
}) {
  return (
    <PermissionContext.Provider value={{ permissions }}>
      {children}
    </PermissionContext.Provider>
  );
}

/** The current member's capabilities, or `null` while unresolved. */
export function usePermissions(): readonly string[] | null {
  return React.useContext(PermissionContext).permissions;
}

/**
 * Whether the current member holds `permission`. A null (unresolved) set reads
 * as "no" — callers that must distinguish loading from denied should read
 * `usePermissions()` directly.
 */
export function useHasPermission(permission: string): boolean {
  const permissions = usePermissions();
  return permissions?.includes(permission) ?? false;
}

// ---------------------------------------------------------------------------
// useRequirePermission — a route-guard hook. If the current member does not
// hold the required capability, redirects to `redirectTo` (default '/').
//
// Degrade-don't-loop rule: never redirect back into the (app) group from
// within the (app) group. The default redirect target '/' is safe — it hits
// the root page, which is outside (app). Only redirects once permissions are
// resolved (non-null), so a loading state never triggers a redirect.
// ---------------------------------------------------------------------------

export function useRequirePermission(
  permission: string,
  redirectTo = '/'
): { isAllowed: boolean } {
  const permissions = usePermissions();
  const router = useRouter();
  const isAllowed = permissions?.includes(permission) ?? false;

  useEffect(() => {
    if (permissions !== null && !permissions.includes(permission)) {
      router.replace(redirectTo);
    }
  }, [permissions, permission, redirectTo, router]);

  return { isAllowed };
}

// ---------------------------------------------------------------------------
// PermissionGate — renders children only when the current member holds the
// required capability. Renders null (or `fallback`) otherwise. Useful for
// hiding capability-only UI without a full redirect.
// ---------------------------------------------------------------------------

export interface PermissionGateProps {
  permission: string;
  /** Content to show when the capability is absent. Defaults to null. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  permission,
  fallback = null,
  children,
}: PermissionGateProps) {
  if (!useHasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
