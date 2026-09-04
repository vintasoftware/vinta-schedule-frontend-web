/**
 * BookPage is an async Server Component — render the awaited element
 * directly, same pattern as the branded login page test. `PublicBookingShell`
 * and `PublicBookingFlow` are mocked to thin stubs; this suite only checks
 * the bare route's wiring: default branding, and the code reaching the flow.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';
import type { TenantBranding } from '@/lib/branding-shared';

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

vi.mock('@/components/public-booking/public-booking-flow', () => ({
  PublicBookingFlow: ({ code }: { code: string }) => (
    <div data-testid='flow'>
      <span data-testid='flow-code'>{code}</span>
    </div>
  ),
}));

import BookPage from './page';

describe('BookPage (/book/[code])', () => {
  it('renders default (vinta) branding — a bare code has no org to look up', async () => {
    render(await BookPage({ params: Promise.resolve({ code: 'abc123' }) }));

    expect(screen.getByTestId('shell-app-name')).toHaveTextContent(
      VINTA_DEFAULT_BRANDING.appName
    );
    expect(screen.getByTestId('shell-logo')).toHaveTextContent(
      VINTA_DEFAULT_BRANDING.logoUrl
    );
  });

  it('passes the code through to PublicBookingFlow', async () => {
    render(await BookPage({ params: Promise.resolve({ code: 'abc123' }) }));

    expect(screen.getByTestId('flow-code')).toHaveTextContent('abc123');
  });
});
