/**
 * BrandedLoginPage is an async Server Component: it awaits branding + auth
 * config, then renders LoginForm. React Testing Library can't render an async
 * component function directly, so we await the page element first (same
 * pattern as privacy/terms page tests).
 *
 * LoginForm is mocked to a sync stub — its interactive behavior is covered
 * elsewhere; this suite only verifies slug → branding wiring and auth-config
 * degradation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';
import type { TenantBranding } from '@/lib/branding-shared';

const fetchBrandingForSlug = vi.fn();
vi.mock('@/lib/branding-server', () => ({
  fetchBrandingForSlug: (...args: unknown[]) => fetchBrandingForSlug(...args),
}));

const getAuthByClientV1Config = vi.fn();
vi.mock('@/auth-client', () => ({
  getAuthByClientV1Config: (...args: unknown[]) =>
    getAuthByClientV1Config(...args),
}));

vi.mock('@/components/authentication/login-form', () => ({
  default: ({
    socialProviders,
    branding,
  }: {
    socialProviders: unknown[];
    branding?: TenantBranding;
  }) => (
    <div data-testid='login-form'>
      <span data-testid='provider-count'>{socialProviders.length}</span>
      <span data-testid='branding-app-name'>
        {branding?.appName ?? '(none)'}
      </span>
      <span data-testid='branding-logo'>{branding?.logoUrl ?? '(none)'}</span>
    </div>
  ),
}));

import BrandedLoginPage from './page';

describe('BrandedLoginPage (/auth/login/[slug])', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthByClientV1Config.mockResolvedValue({
      data: { status: 500 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches branding by slug and passes it to LoginForm', async () => {
    const branding: TenantBranding = {
      appName: 'Acme Scheduling',
      logoUrl: 'https://api.example.com/branding/logo/acme/',
      primaryColor: '#1A73E8',
      secondaryColor: '#FBBC04FF',
    };
    fetchBrandingForSlug.mockResolvedValueOnce(branding);
    getAuthByClientV1Config.mockResolvedValueOnce({
      data: {
        status: 200,
        data: {
          socialaccount: {
            providers: [{ id: 'google', name: 'Google' }],
          },
        },
      },
    });

    render(
      await BrandedLoginPage({
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
    expect(screen.getByTestId('provider-count')).toHaveTextContent('1');
  });

  it('still renders LoginForm with default branding for an unknown slug (no error page)', async () => {
    fetchBrandingForSlug.mockResolvedValueOnce(VINTA_DEFAULT_BRANDING);

    render(
      await BrandedLoginPage({
        params: Promise.resolve({ slug: 'no-such-org-xyz' }),
      })
    );

    expect(fetchBrandingForSlug).toHaveBeenCalledWith('no-such-org-xyz');
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.getByTestId('branding-app-name')).toHaveTextContent(
      VINTA_DEFAULT_BRANDING.appName
    );
    expect(screen.getByTestId('branding-logo')).toHaveTextContent(
      VINTA_DEFAULT_BRANDING.logoUrl
    );
    expect(screen.queryByText(/not found|error/i)).not.toBeInTheDocument();
  });

  it('degrades gracefully when auth config is unreachable (empty social providers)', async () => {
    fetchBrandingForSlug.mockResolvedValueOnce(VINTA_DEFAULT_BRANDING);
    getAuthByClientV1Config.mockResolvedValueOnce({
      data: undefined,
      error: { detail: 'unreachable' },
    });

    render(
      await BrandedLoginPage({
        params: Promise.resolve({ slug: 'acme' }),
      })
    );

    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.getByTestId('provider-count')).toHaveTextContent('0');
  });
});
