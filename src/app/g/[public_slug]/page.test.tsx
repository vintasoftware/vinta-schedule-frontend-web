/**
 * CodelessAppointmentTypeBookingPage is an async Server Component — render the
 * awaited element directly, same pattern as `/book/[code]/page.test.tsx`.
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

import CodelessAppointmentTypeBookingPage, { metadata } from './page';

describe('CodelessAppointmentTypeBookingPage (/g/[public_slug])', () => {
  it('is noindex — an unauthenticated write surface, same rule as every /book/* route', () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('renders default (vinta) branding — a bare slug has no org to look up', async () => {
    render(
      await CodelessAppointmentTypeBookingPage({
        params: Promise.resolve({ public_slug: 'surgery-team' }),
      })
    );

    expect(screen.getByTestId('shell-app-name')).toHaveTextContent(
      VINTA_DEFAULT_BRANDING.appName
    );
  });

  it('passes public_slug through to CodelessAppointmentTypeBookingFlow, with no org slug', async () => {
    render(
      await CodelessAppointmentTypeBookingPage({
        params: Promise.resolve({ public_slug: 'surgery-team' }),
      })
    );

    expect(screen.getByTestId('flow-public-slug')).toHaveTextContent(
      'surgery-team'
    );
    expect(screen.getByTestId('flow-slug')).toBeEmptyDOMElement();
  });
});
