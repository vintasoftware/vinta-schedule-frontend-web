/**
 * BrandedSignupPage is an async Server Component: it awaits branding, then
 * renders SignupForm. React Testing Library can't render an async component
 * function directly, so we await the page element first (same pattern as the
 * branded login page test).
 *
 * SignupForm is mocked to a sync stub — its form behavior is covered by
 * `src/app/auth/signup/page.test.tsx`; this suite only verifies the
 * slug → branding → locked-organization wiring.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';
import type { TenantBranding } from '@/lib/branding-shared';

const fetchBrandingForSlug = vi.fn();
vi.mock('@/lib/branding-server', () => ({
  fetchBrandingForSlug: (...args: unknown[]) => fetchBrandingForSlug(...args),
}));

vi.mock('@/components/authentication/signup-form', () => ({
  default: ({
    branding,
    slug,
    lockedOrganizationName,
  }: {
    branding?: TenantBranding;
    slug?: string;
    lockedOrganizationName?: string;
  }) => (
    <div data-testid='signup-form'>
      <span data-testid='branding-app-name'>
        {branding?.appName ?? '(none)'}
      </span>
      <span data-testid='branding-logo'>{branding?.logoUrl ?? '(none)'}</span>
      <span data-testid='branding-primary'>
        {branding?.primaryColor || '(none)'}
      </span>
      <span data-testid='branding-slug'>{slug ?? '(none)'}</span>
      <span data-testid='locked-org'>{lockedOrganizationName ?? '(none)'}</span>
    </div>
  ),
}));

import BrandedSignupPage from './page';

const acmeBranding: TenantBranding = {
  appName: 'Acme Scheduling',
  logoUrl: 'https://api.example.com/branding/logo/acme/',
  primaryColor: '#1A73E8',
  secondaryColor: '#FFFFFF',
};

describe('BrandedSignupPage (/o/[slug]/auth/signup)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches branding by slug and passes it to SignupForm', async () => {
    fetchBrandingForSlug.mockResolvedValueOnce(acmeBranding);

    render(
      await BrandedSignupPage({ params: Promise.resolve({ slug: 'acme' }) })
    );

    expect(fetchBrandingForSlug).toHaveBeenCalledWith('acme');
    expect(screen.getByTestId('branding-app-name')).toHaveTextContent(
      'Acme Scheduling'
    );
    expect(screen.getByTestId('branding-logo')).toHaveTextContent(
      'https://api.example.com/branding/logo/acme/'
    );
    expect(screen.getByTestId('branding-primary')).toHaveTextContent('#1A73E8');
    expect(screen.getByTestId('branding-slug')).toHaveTextContent('acme');
  });

  it('locks the organization name to the tenant app name', async () => {
    fetchBrandingForSlug.mockResolvedValueOnce(acmeBranding);

    render(
      await BrandedSignupPage({ params: Promise.resolve({ slug: 'acme' }) })
    );

    expect(screen.getByTestId('locked-org')).toHaveTextContent(
      'Acme Scheduling'
    );
  });

  it('locks the field for a tenant that customized only the app name', async () => {
    fetchBrandingForSlug.mockResolvedValueOnce({
      ...VINTA_DEFAULT_BRANDING,
      appName: 'Acme Scheduling',
    });

    render(
      await BrandedSignupPage({ params: Promise.resolve({ slug: 'acme' }) })
    );

    expect(screen.getByTestId('locked-org')).toHaveTextContent(
      'Acme Scheduling'
    );
  });

  it('leaves the organization name unlocked for an unknown slug', async () => {
    fetchBrandingForSlug.mockResolvedValueOnce(VINTA_DEFAULT_BRANDING);

    render(
      await BrandedSignupPage({
        params: Promise.resolve({ slug: 'no-such-org-xyz' }),
      })
    );

    // Falling back to the vinta identity must not put "Vinta Schedule" in the
    // visitor's organization field.
    expect(screen.getByTestId('locked-org')).toHaveTextContent('(none)');
    expect(screen.getByTestId('signup-form')).toBeInTheDocument();
    expect(screen.queryByText(/not found|error/i)).not.toBeInTheDocument();
  });
});
