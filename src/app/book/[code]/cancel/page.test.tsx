/**
 * BookCancelPage is an async Server Component — render the awaited element
 * directly, same pattern as `/book/[code]/page.test.tsx`.
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
      {children}
    </div>
  ),
}));

vi.mock('@/components/public-booking/cancel-flow', () => ({
  CancelFlow: ({ code }: { code: string }) => (
    <div data-testid='flow'>
      <span data-testid='flow-code'>{code}</span>
    </div>
  ),
}));

import BookCancelPage, { metadata } from './page';

describe('BookCancelPage (/book/[code]/cancel)', () => {
  it('is noindex — a booking code in the URL is a live credential', () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('renders default (vinta) branding — a bare code has no org to look up', async () => {
    render(
      await BookCancelPage({ params: Promise.resolve({ code: 'abc123' }) })
    );

    expect(screen.getByTestId('shell-app-name')).toHaveTextContent(
      VINTA_DEFAULT_BRANDING.appName
    );
  });

  it('passes the code through to CancelFlow', async () => {
    render(
      await BookCancelPage({ params: Promise.resolve({ code: 'abc123' }) })
    );

    expect(screen.getByTestId('flow-code')).toHaveTextContent('abc123');
  });
});
