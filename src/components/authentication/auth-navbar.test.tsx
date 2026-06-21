import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthNavbar } from './auth-navbar';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';

// next/navigation is pulled in transitively by components that use Link/hooks.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RESELLER_BRANDING = {
  appName: 'Acme Corp',
  logoUrl: 'https://acme.example.com/logo.svg',
  primaryColor: '#4f46e5',
  secondaryColor: '#7c3aed',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthNavbar — branding', () => {
  it('renders the branded img with reseller src and alt when given custom branding', () => {
    render(<AuthNavbar branding={RESELLER_BRANDING} />);

    const logo = screen.getByRole('img', { name: RESELLER_BRANDING.appName });
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', RESELLER_BRANDING.logoUrl);
  });

  it('does NOT render a reseller img when given vinta default branding', () => {
    render(<AuthNavbar branding={VINTA_DEFAULT_BRANDING} />);

    // The vinta BrandMark uses its own img with alt="Vinta" — the reseller
    // logo should not be present.
    expect(
      screen.queryByRole('img', { name: RESELLER_BRANDING.appName })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: RESELLER_BRANDING.logoUrl })
    ).not.toBeInTheDocument();
  });

  it('renders the vinta wordmark (alt="Vinta") when no branding is supplied', () => {
    render(<AuthNavbar />);

    // BrandMark renders the vinta-wordmark.svg with alt="Vinta".
    const vintaMark = screen.getByRole('img', { name: 'Vinta' });
    expect(vintaMark).toBeInTheDocument();
    expect(vintaMark).toHaveAttribute('src', '/vinta-wordmark.svg');
  });

  it('renders the vinta wordmark when explicitly given vinta default branding', () => {
    render(<AuthNavbar branding={VINTA_DEFAULT_BRANDING} />);

    const vintaMark = screen.getByRole('img', { name: 'Vinta' });
    expect(vintaMark).toBeInTheDocument();
    expect(vintaMark).toHaveAttribute('src', '/vinta-wordmark.svg');
  });

  it('renders a branded img (not the vinta mark) for a tenant with custom appName only', () => {
    // A tenant with a custom appName but default logo — isVintaDefault must
    // be false so the appName is surfaced rather than silently dropped.
    const customNameOnly = {
      ...VINTA_DEFAULT_BRANDING,
      appName: 'Custom App',
    };
    render(<AuthNavbar branding={customNameOnly} />);

    // The branded path renders an img with the custom appName as alt.
    expect(screen.getByRole('img', { name: 'Custom App' })).toBeInTheDocument();
    // The vinta wordmark should not also appear.
    expect(
      screen.queryByRole('img', { name: 'Vinta' })
    ).not.toBeInTheDocument();
  });
});
