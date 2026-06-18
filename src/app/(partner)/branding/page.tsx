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
 * 403 when the acting org is not a reseller or the user is not an admin.
 *
 * States:
 *   • Loading — query in flight.
 *   • 403 — org is not a reseller or user is not an admin; neutral no-access.
 *   • 404 — no branding row yet (first-write); form renders with empty defaults.
 *   • 200 — form prefilled with the saved branding.
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
  // Error state — distinguish 403 (no access) from other errors.
  // ---------------------------------------------------------------------------
  if (brandingQuery.isError) {
    const status = (
      brandingQuery.error as { status?: number; response?: { status?: number } }
    )?.status;

    if (status === 403) {
      return (
        <Stack gap={6}>
          <PageHeader
            title='Branding'
            description='Customize authentication pages and emails for your reseller organization.'
          />
          <Alert>
            <AlertTitle>Access not available</AlertTitle>
            <AlertDescription>
              Branding customization is only available to reseller
              organizations. Contact your Vinta administrator if you believe
              this is an error.
            </AlertDescription>
          </Alert>
        </Stack>
      );
    }

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
  // Success — data may be null (404 / "not yet configured") or an existing row.
  // ---------------------------------------------------------------------------
  const branding = brandingQuery.data ?? null;

  return (
    <Stack gap={6}>
      <PageHeader
        title='Branding'
        description='Customize authentication pages and emails for your reseller organization.'
      />
      <BrandingForm initialBranding={branding} />
    </Stack>
  );
}
