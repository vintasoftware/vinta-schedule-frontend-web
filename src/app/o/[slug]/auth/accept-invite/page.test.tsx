/**
 * BrandedAcceptInvitePage is an async Server Component: it awaits branding,
 * then renders AcceptInviteForm. React Testing Library can't render an async
 * component function directly, so we await the page element first (same
 * pattern as the branded login page test).
 *
 * AcceptInviteForm is mocked to a sync stub — its interactive behavior is
 * covered in `src/app/auth/accept-invite/page.test.tsx`; this suite only
 * verifies slug → branding wiring.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';
import type { TenantBranding } from '@/lib/branding-shared';

const fetchBrandingForSlug = vi.fn();
vi.mock('@/lib/branding-server', () => ({
  fetchBrandingForSlug: (...args: unknown[]) => fetchBrandingForSlug(...args),
}));

vi.mock('@/components/authentication/accept-invite-form', () => ({
  default: ({ branding }: { branding?: TenantBranding }) => (
    <div data-testid='accept-invite-form'>
      <span data-testid='branding-app-name'>
        {branding?.appName ?? '(none)'}
      </span>
      <span data-testid='branding-logo'>{branding?.logoUrl ?? '(none)'}</span>
    </div>
  ),
}));

import BrandedAcceptInvitePage from './page';

describe('BrandedAcceptInvitePage (/o/[slug]/auth/accept-invite)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches branding by slug and passes it to AcceptInviteForm', async () => {
    const branding: TenantBranding = {
      appName: 'Acme Scheduling',
      logoUrl: 'https://api.example.com/branding/logo/acme/',
      primaryColor: '#1A73E8',
      secondaryColor: '#FBBC04FF',
    };
    fetchBrandingForSlug.mockResolvedValueOnce(branding);

    render(
      await BrandedAcceptInvitePage({
        params: Promise.resolve({ slug: 'acme' }),
      })
    );

    expect(fetchBrandingForSlug).toHaveBeenCalledWith('acme');
    expect(screen.getByTestId('branding-app-name')).toHaveTextContent(
      'Acme Scheduling'
    );
    expect(screen.getByTestId('branding-logo')).toHaveTextContent(
      'https://api.example.com/branding/logo/acme/'
    );
  });

  it('still renders AcceptInviteForm with default branding for an unknown slug (no error page)', async () => {
    fetchBrandingForSlug.mockResolvedValueOnce(VINTA_DEFAULT_BRANDING);

    render(
      await BrandedAcceptInvitePage({
        params: Promise.resolve({ slug: 'no-such-org-xyz' }),
      })
    );

    expect(fetchBrandingForSlug).toHaveBeenCalledWith('no-such-org-xyz');
    expect(screen.getByTestId('accept-invite-form')).toBeInTheDocument();
    expect(screen.getByTestId('branding-app-name')).toHaveTextContent(
      VINTA_DEFAULT_BRANDING.appName
    );
    expect(screen.getByTestId('branding-logo')).toHaveTextContent(
      VINTA_DEFAULT_BRANDING.logoUrl
    );
    expect(screen.queryByText(/not found|error/i)).not.toBeInTheDocument();
  });
});
