/**
 * BrandedCodelessAppointmentTypeBookingPage is an async Server Component — render the
 * awaited element directly, same pattern as the branded
 * `/o/[slug]/book/[code]/page.test.tsx`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';
import type { TenantBranding } from '@/lib/branding-shared';

const fetchBrandingForSlug = vi.fn();
vi.mock('@/lib/branding-server', () => ({
  fetchBrandingForSlug: (...args: unknown[]) => fetchBrandingForSlug(...args),
}));

vi.mock('@/components/public-booking/public-booking-shell', () => ({
  PublicBookingShell: ({
    branding,
    children,
  }: {
    branding: TenantBranding;
    children: React.ReactNode;
  }) => (
    <div data-testid='shell'>
      <span data-testid='shell-app-name'>{branding.appName}</span>
      <span data-testid='shell-logo'>{branding.logoUrl}</span>
      {children}
    </div>
  ),
}));

vi.mock(
  '@/components/public-booking/codeless-appointment-type-booking-flow',
  () => ({
    CodelessAppointmentTypeBookingFlow: ({
      publicSlug,
      slug,
    }: {
      publicSlug: string;
      slug?: string;
    }) => (
      <div data-testid='flow'>
        <span data-testid='flow-public-slug'>{publicSlug}</span>
        <span data-testid='flow-slug'>{slug}</span>
      </div>
    ),
  })
);

import BrandedCodelessAppointmentTypeBookingPage, { metadata } from './page';

describe('BrandedCodelessAppointmentTypeBookingPage (/o/[slug]/g/[public_slug])', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is noindex — an unauthenticated write surface, same rule as every /book/* route', () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('fetches branding by org slug and passes it to the shell, plus the appointment type public_slug and org slug to the flow', async () => {
    const branding: TenantBranding = {
      appName: 'Acme Scheduling',
      logoUrl: 'https://api.example.com/branding/logo/acme/',
      primaryColor: '#1A73E8',
      secondaryColor: '#FBBC04FF',
    };
    fetchBrandingForSlug.mockResolvedValueOnce(branding);

    render(
      await BrandedCodelessAppointmentTypeBookingPage({
        params: Promise.resolve({
          slug: 'acme',
          public_slug: 'surgery-team',
        }),
      })
    );

    expect(fetchBrandingForSlug).toHaveBeenCalledWith('acme');
    expect(screen.getByTestId('shell-app-name')).toHaveTextContent(
      'Acme Scheduling'
    );
    expect(screen.getByTestId('flow-public-slug')).toHaveTextContent(
      'surgery-team'
    );
    expect(screen.getByTestId('flow-slug')).toHaveTextContent('acme');
  });

  it('falls back to default branding for an unknown org slug (no error page)', async () => {
    fetchBrandingForSlug.mockResolvedValueOnce(VINTA_DEFAULT_BRANDING);

    render(
      await BrandedCodelessAppointmentTypeBookingPage({
        params: Promise.resolve({
          slug: 'no-such-org-xyz',
          public_slug: 'surgery-team',
        }),
      })
    );

    expect(screen.getByTestId('shell-app-name')).toHaveTextContent(
      VINTA_DEFAULT_BRANDING.appName
    );
    expect(screen.queryByText(/not found|error/i)).not.toBeInTheDocument();
  });
});
