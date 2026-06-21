'use client';

import * as React from 'react';
import { Stack, PageHeader, Text, Center } from '@/components/layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BrandingForm } from '@/components/branding/branding-form';
import { useBranding } from '@/hooks/branding/use-branding';

/**
 * BrandingPage — reseller-admin branding console.
 *
 * Lives in the (partner) route group so it renders with a neutral chrome (no
 * tenant sidebar/shell). Auth/role gating is API-driven: the backend returns
 * 403 when the acting org is not a reseller or the user is not an admin. The
 * useBranding hook inspects the HTTP status directly (throwOnError:false) and
 * returns a discriminated result so each state can be rendered correctly.
 *
 * States:
 *   • Loading — query in flight.
 *   • forbidden — 403: org is not a reseller or user is not an admin; neutral no-access.
 *   • not_configured — 404: no branding row yet (first-write); form renders with empty defaults.
 *   • ok — 200: form prefilled with the saved branding.
 *   • isError — network/server error; destructive alert.
 */
export default function BrandingPage() {
  const { brandingQuery } = useBranding();

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (brandingQuery.isLoading) {
    return (
      <Center className='flex-1'>
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
          description='Customize authentication pages and emails for your reseller organization.'
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
          description='Customize authentication pages and emails for your reseller organization.'
        />
        <Alert>
          <AlertTitle>Access not available</AlertTitle>
          <AlertDescription>
            Branding customization is only available to reseller organizations.
            Contact your Vinta administrator if you believe this is an error.
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
        description='Customize authentication pages and emails for your reseller organization.'
      />
      <BrandingForm initialBranding={initialBranding} />
    </Stack>
  );
}
