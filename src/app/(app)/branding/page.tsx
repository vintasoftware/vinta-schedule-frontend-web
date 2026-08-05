'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Stack,
  PageHeader,
  Text,
  Center,
} from 'vinta-schedule-design-system/layout';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import { BrandingForm } from '@/components/branding/branding-form';
import { useBranding } from '@/hooks/branding/use-branding';
import { useCurrentOrganization } from '@/hooks/organizations/use-current-organization';

/**
 * BrandingPage — white-label branding console for eligible organizations.
 *
 * A normal internal (app) page: it renders inside the tenant AppShell. The
 * sidebar link is shown only when `can_manage_branding` is true on the current
 * membership (see app-layout-client). Ineligible users who deep-link here are
 * redirected away — the page is absent, not merely refused.
 *
 * GET 403 from `/branding/` remains a rare backstop when cache is stale or the
 * server rejects read access; useBranding surfaces that as a neutral alert.
 *
 * States:
 *   • Redirect — membership lacks `can_manage_branding`.
 *   • Loading — org or branding query in flight.
 *   • forbidden — 403 from API (stale entitlement / server backstop).
 *   • not_configured — 404: no branding row yet (first-write).
 *   • ok — 200: form prefilled with saved branding.
 *   • isError — network/server error; destructive alert.
 */
export default function BrandingPage() {
  const router = useRouter();
  const {
    membership,
    isOnboarded,
    isLoading: isOrgLoading,
  } = useCurrentOrganization();
  const canManageBranding =
    isOnboarded && membership?.can_manage_branding === true;

  const { brandingQuery } = useBranding({
    enabled: !isOrgLoading && canManageBranding,
  });

  useEffect(() => {
    if (!isOrgLoading && isOnboarded && !canManageBranding) {
      router.replace('/');
    }
  }, [isOrgLoading, isOnboarded, canManageBranding, router]);

  if (isOrgLoading || (isOnboarded && !canManageBranding)) {
    return null;
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (brandingQuery.isLoading) {
    return (
      <Center grow>
        <Text color='muted-foreground'>Loading branding settings…</Text>
      </Center>
    );
  }

  // ---------------------------------------------------------------------------
  // Genuine error state (network/server failure — not 403/404 which are
  // handled as discriminated data states in useBranding).
  // ---------------------------------------------------------------------------
  if (brandingQuery.isError) {
    return (
      <Stack gap={6}>
        <PageHeader
          title='Branding'
          description='Customize authentication pages and emails for your organization.'
        />
        <Alert variant='destructive'>
          <AlertTitle>Failed to load branding settings</AlertTitle>
          <AlertDescription>
            {brandingQuery.error instanceof Error
              ? brandingQuery.error.message
              : 'An unexpected error occurred. Please try again.'}
          </AlertDescription>
        </Alert>
      </Stack>
    );
  }

  // ---------------------------------------------------------------------------
  // Discriminated data states — 403 / 404 / 200
  // ---------------------------------------------------------------------------
  const result = brandingQuery.data;

  if (result?.status === 'forbidden') {
    return (
      <Stack gap={6}>
        <PageHeader
          title='Branding'
          description='Customize authentication pages and emails for your organization.'
        />
        <Alert>
          <AlertTitle>Access not available</AlertTitle>
          <AlertDescription>
            White-label branding is not available for this organization. Contact
            your Vinta administrator if you believe this is an error.
          </AlertDescription>
        </Alert>
      </Stack>
    );
  }

  // Both 'not_configured' (404 — first write) and 'ok' (200 — existing row)
  // render the form. For 'not_configured', initialBranding is null and the
  // form shows empty defaults. For 'ok', the form prefills with saved values.
  const initialBranding = result?.status === 'ok' ? result.branding : null;

  return (
    <Stack gap={6}>
      <PageHeader
        title='Branding'
        description='Customize authentication pages and emails for your organization.'
      />
      <BrandingForm initialBranding={initialBranding} />
    </Stack>
  );
}
