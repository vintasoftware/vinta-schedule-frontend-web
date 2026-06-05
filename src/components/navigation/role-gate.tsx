'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { RoleEnum } from '@/client';

// ---------------------------------------------------------------------------
// Role context — exposes the current user's role to any component in the
// (app) route group. Set once by the AppLayout (layout.tsx); consumed by
// RoleGate and useRequireRole.
// ---------------------------------------------------------------------------

interface RoleContextValue {
  role: RoleEnum | null;
}

const RoleContext = React.createContext<RoleContextValue>({ role: null });

export function RoleProvider({
  role,
  children,
}: {
  role: RoleEnum | null;
  children: React.ReactNode;
}) {
  return (
    <RoleContext.Provider value={{ role }}>{children}</RoleContext.Provider>
  );
}

export function useRole(): RoleEnum | null {
  return React.useContext(RoleContext).role;
}

// ---------------------------------------------------------------------------
// useRequireRole — a route-guard hook. If the current user's role does not
// match the required role, redirects to `redirectTo` (default '/').
//
// Degrade-don't-loop rule: never redirect back into the (app) group from
// within the (app) group. The default redirect target '/' is safe — it hits
// the root page, which is outside (app).
// ---------------------------------------------------------------------------

export function useRequireRole(
  required: RoleEnum,
  redirectTo = '/'
): { isAllowed: boolean } {
  const role = useRole();
  const router = useRouter();

  useEffect(() => {
    // Only redirect once we have a resolved role (not null / loading).
    if (role !== null && role !== required) {
      router.replace(redirectTo);
    }
  }, [role, required, redirectTo, router]);

  return { isAllowed: role === required };
}

// ---------------------------------------------------------------------------
// RoleGate — renders children only when the current user holds the required
// role. Renders null (or `fallback`) otherwise. Useful for hiding admin-only
// nav items without a full redirect.
// ---------------------------------------------------------------------------

export interface RoleGateProps {
  role: RoleEnum;
  /** Content to show when the role does NOT match. Defaults to null. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGate({ role, fallback = null, children }: RoleGateProps) {
  const currentRole = useRole();

  if (currentRole !== role) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
