/**
 * BillingProfilePage (Phase 6) tests.
 *
 * The page renders the `BillingProfileForm` island. The read + write hooks are
 * mocked so the test asserts the two route-level states end to end:
 *   • an existing profile renders prefilled values;
 *   • a no-profile (404 / absent) org renders the empty create form — not a
 *     crash.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { BillingProfile } from '@/client';
import { RoleProvider } from '@/components/navigation/role-gate';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('@/hooks/billing/use-billing-profile', () => ({
  useBillingProfile: vi.fn(),
}));
vi.mock('@/hooks/billing/use-create-billing-profile', () => ({
  useCreateBillingProfile: vi.fn(),
}));
vi.mock('@/hooks/billing/use-update-billing-profile', () => ({
  useUpdateBillingProfile: vi.fn(),
}));

import { useBillingProfile } from '@/hooks/billing/use-billing-profile';
import { useCreateBillingProfile } from '@/hooks/billing/use-create-billing-profile';
import { useUpdateBillingProfile } from '@/hooks/billing/use-update-billing-profile';
import BillingProfilePage from './page';

const PROFILE: BillingProfile = {
  id: 1,
  contact_first_name: 'Ada',
  contact_last_name: 'Lovelace',
  contact_email: 'ada@example.com',
  contact_phone: '+1 555 000 0000',
  document_type: 'tax_id',
  document_number: '123456789',
  billing_address: {
    id: 10,
    street_name: 'Main',
    street_number: '42',
    neighborhood: 'Center',
    address_line_2: '',
    city: 'London',
    state: 'LDN',
    country: 'GB',
    zip_code: 'EC1A',
  },
  created: '2026-08-09T00:00:00Z',
  modified: '2026-08-09T00:00:00Z',
};

function mockProfile(profile: BillingProfile | null) {
  vi.mocked(useBillingProfile).mockReturnValue({
    billingProfile: profile,
    isLoading: false,
    isError: profile === null,
    error: null,
    billingProfileQuery: { refetch: vi.fn() } as unknown as ReturnType<
      typeof useBillingProfile
    >['billingProfileQuery'],
  });
}

function renderPage() {
  return render(
    <RoleProvider role='admin'>
      <BillingProfilePage />
    </RoleProvider>
  );
}

describe('BillingProfilePage (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateBillingProfile).mockReturnValue({
      createBillingProfile: vi.fn(),
      createBillingProfileMutation: { isPending: false } as ReturnType<
        typeof useCreateBillingProfile
      >['createBillingProfileMutation'],
    });
    vi.mocked(useUpdateBillingProfile).mockReturnValue({
      updateBillingProfile: vi.fn(),
      updateBillingProfileMutation: { isPending: false } as ReturnType<
        typeof useUpdateBillingProfile
      >['updateBillingProfileMutation'],
    });
  });

  it('renders existing profile values', () => {
    mockProfile(PROFILE);

    renderPage();

    expect(screen.getByLabelText('First name')).toHaveValue('Ada');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    expect(screen.getByLabelText('Document number')).toHaveValue('123456789');
    expect(
      screen.getByRole('button', { name: 'Save changes' })
    ).toBeInTheDocument();
  });

  it('renders the empty create form for a no-profile (404) org, not a crash', () => {
    mockProfile(null);

    renderPage();

    expect(screen.getByLabelText('First name')).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Create profile' })
    ).toBeInTheDocument();
  });
});
