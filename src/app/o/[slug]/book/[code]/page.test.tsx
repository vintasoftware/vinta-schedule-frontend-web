/**
 * BrandedBookPage is an async Server Component — render the awaited element
 * directly, same pattern as the branded login page test.
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

vi.mock('@/components/public-booking/public-booking-entry', () => ({
  PublicBookingEntry: ({ code, slug }: { code: string; slug?: string }) => (
    <div data-testid='flow'>
      <span data-testid='flow-code'>{code}</span>
      <span data-testid='flow-slug'>{slug}</span>
    </div>
  ),
}));

import BrandedBookPage, { metadata } from './page';

describe('BrandedBookPage (/o/[slug]/book/[code])', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is noindex — a booking code in the URL is a live credential', () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('fetches branding by slug and passes it to the shell', async () => {
    const branding: TenantBranding = {
      appName: 'Acme Scheduling',
      logoUrl: 'https://api.example.com/branding/logo/acme/',
      primaryColor: '#1A73E8',
      secondaryColor: '#FBBC04FF',
    };
    fetchBrandingForSlug.mockResolvedValueOnce(branding);

    render(
      await BrandedBookPage({
        params: Promise.resolve({ slug: 'acme', code: 'abc123' }),
      })
    );

    expect(fetchBrandingForSlug).toHaveBeenCalledWith('acme');
    expect(screen.getByTestId('shell-app-name')).toHaveTextContent(
      'Acme Scheduling'
    );
    expect(screen.getByTestId('flow-code')).toHaveTextContent('abc123');
    // Phase 5: the branded route passes its own slug through so a
    // successful booking's self-service links can be branded too.
    expect(screen.getByTestId('flow-slug')).toHaveTextContent('acme');
  });

  it('falls back to default branding for an unknown slug (no error page)', async () => {
    fetchBrandingForSlug.mockResolvedValueOnce(VINTA_DEFAULT_BRANDING);

    render(
      await BrandedBookPage({
        params: Promise.resolve({ slug: 'no-such-org-xyz', code: 'abc123' }),
      })
    );

    expect(screen.getByTestId('shell-app-name')).toHaveTextContent(
      VINTA_DEFAULT_BRANDING.appName
    );
    expect(screen.queryByText(/not found|error/i)).not.toBeInTheDocument();
  });
});
