/**
 * BillingProfileForm (Phase 6) tests.
 *
 * The read + write hooks are mocked; the test drives real react-hook-form + zod
 * validation and asserts:
 *   • zod rejects an invalid email / a missing required field (no write fires);
 *   • the CREATE path (no existing profile) POSTs the full trimmed body;
 *   • the UPDATE path (existing profile) prefills and PATCHes;
 *   • a non-admin sees the read-only view (no inputs, no submit);
 *   • a 409-on-create surfaces "a billing profile already exists" and refetches,
 *     with no unhandled error;
 *   • a 403/429-shaped `{ detail }` on create is NOT misread as "already exists" —
 *     it renders the error toast and does not refetch;
 *   • clearing an optional field on the update path PATCHes the cleared value as
 *     "" so the clear persists (an omitted key would leave the old value).
 *
 * Phase 4 (billing-hardening plan) additions:
 *   • the document-type Select offers exactly the nine enum values, and
 *     leaving it unselected blocks submit;
 *   • a legacy/out-of-enum `document_type` still renders in the read view
 *     (open on read, closed on write);
 *   • a server field-validation 400 (incl. nested `billing_address.*`) maps
 *     onto the matching field via `setError`, not a generic toast;
 *   • a defensive 403 (the capability backstop) shows a clear
 *     billing-permission message and writes nothing.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BillingProfile } from '@/client';
import { PermissionProvider } from '@/components/navigation/permission-gate';
import { DOCUMENT_TYPE_OPTIONS } from '@/lib/billing/document-type-labels';

// Radix UI Select (the document-type field) uses pointer-capture APIs jsdom
// doesn't implement — same polyfill as booking-form.test.tsx.
beforeAll(() => {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import { toast } from 'sonner';

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
import { BillingProfileForm } from './billing-profile-form';

const refetch = vi.fn();
const createBillingProfile = vi.fn();
const updateBillingProfile = vi.fn();

const EXISTING_PROFILE: BillingProfile = {
  id: 1,
  contact_first_name: 'Ada',
  contact_last_name: 'Lovelace',
  contact_email: 'ada@example.com',
  contact_phone: '+1 555 000 0000',
  document_type: 'OTHER',
  document_number: '123456789',
  billing_address: {
    id: 10,
    street_name: 'Main',
    street_number: '42',
    neighborhood: 'Center',
    address_line_2: 'Suite 5',
    city: 'London',
    state: 'LDN',
    country: 'GB',
    zip_code: 'EC1A',
  },
  created: '2026-08-09T00:00:00Z',
  modified: '2026-08-09T00:00:00Z',
};

function mockProfile(profile: BillingProfile | null, isLoading = false) {
  vi.mocked(useBillingProfile).mockReturnValue({
    billingProfile: profile,
    isLoading,
    isError: profile === null && !isLoading,
    error: null,
    billingProfileQuery: { refetch } as unknown as ReturnType<
      typeof useBillingProfile
    >['billingProfileQuery'],
  });
}

async function selectDocumentType(
  user: ReturnType<typeof userEvent.setup>,
  label: string
) {
  await user.click(screen.getByRole('combobox', { name: 'Document type' }));
  await user.click(await screen.findByRole('option', { name: label }));
}

async function fillCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('First name'), 'Grace');
  await user.type(screen.getByLabelText('Last name (optional)'), 'Hopper');
  await user.type(screen.getByLabelText('Email'), 'grace@example.com');
  await user.type(screen.getByLabelText('Phone (optional)'), '+1 555 111 2222');
  await selectDocumentType(user, 'Other');
  await user.type(screen.getByLabelText('Document number'), '987654321');
  await user.type(screen.getByLabelText('Street'), 'Second');
  await user.type(screen.getByLabelText('Number'), '7');
  await user.type(screen.getByLabelText('Neighborhood (optional)'), 'Downtown');
  await user.type(screen.getByLabelText('Address line 2 (optional)'), 'Apt 2');
  await user.type(screen.getByLabelText('City'), 'Baltimore');
  await user.type(screen.getByLabelText('State / region'), 'MD');
  await user.type(screen.getByLabelText('Country'), 'US');
  await user.type(screen.getByLabelText('Postal code'), '21201');
}

const FULL_BODY = {
  contact_first_name: 'Grace',
  contact_last_name: 'Hopper',
  contact_email: 'grace@example.com',
  contact_phone: '+1 555 111 2222',
  document_type: 'OTHER',
  document_number: '987654321',
  billing_address: {
    street_name: 'Second',
    street_number: '7',
    neighborhood: 'Downtown',
    address_line_2: 'Apt 2',
    city: 'Baltimore',
    state: 'MD',
    country: 'US',
    zip_code: '21201',
  },
};

// A billing manager holds `payments.manage_billing`; a plain member holds no
// capabilities; `null` models the still-loading permission set.
function permissionsFor(
  role: 'admin' | 'member' | null
): readonly string[] | null {
  if (role === null) return null;
  return role === 'admin' ? ['payments.manage_billing'] : [];
}

function renderForm(role: 'admin' | 'member' | null = 'admin') {
  return render(
    <PermissionProvider permissions={permissionsFor(role)}>
      <BillingProfileForm />
    </PermissionProvider>
  );
}

describe('BillingProfileForm (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateBillingProfile).mockReturnValue({
      createBillingProfile,
      createBillingProfileMutation: { isPending: false } as ReturnType<
        typeof useCreateBillingProfile
      >['createBillingProfileMutation'],
    });
    vi.mocked(useUpdateBillingProfile).mockReturnValue({
      updateBillingProfile,
      updateBillingProfileMutation: { isPending: false } as ReturnType<
        typeof useUpdateBillingProfile
      >['updateBillingProfileMutation'],
    });
    createBillingProfile.mockResolvedValue({ id: 1 });
    updateBillingProfile.mockResolvedValue({ id: 1 });
  });

  it('rejects an invalid email and does not submit', async () => {
    mockProfile(null);
    const user = userEvent.setup();
    renderForm('admin');

    await fillCreateForm(user);
    // Overwrite the email with an invalid value.
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'not-an-email');

    await user.click(screen.getByTestId('billing-profile-submit'));

    expect(
      await screen.findByText('Enter a valid email address.')
    ).toBeInTheDocument();
    expect(createBillingProfile).not.toHaveBeenCalled();
  });

  it('rejects a missing required field and does not submit', async () => {
    mockProfile(null);
    const user = userEvent.setup();
    renderForm('admin');

    // Leave first name empty; fill the rest.
    await user.type(screen.getByLabelText('Email'), 'grace@example.com');
    await selectDocumentType(user, 'Other');
    await user.type(screen.getByLabelText('Document number'), '987654321');

    await user.click(screen.getByTestId('billing-profile-submit'));

    expect(await screen.findByText('Enter a first name.')).toBeInTheDocument();
    expect(createBillingProfile).not.toHaveBeenCalled();
  });

  it('POSTs the full trimmed body on the create path (no existing profile)', async () => {
    mockProfile(null);
    const user = userEvent.setup();
    renderForm('admin');

    await fillCreateForm(user);
    await user.click(screen.getByTestId('billing-profile-submit'));

    await waitFor(() => expect(createBillingProfile).toHaveBeenCalledTimes(1));
    expect(createBillingProfile).toHaveBeenCalledWith(FULL_BODY);
    expect(updateBillingProfile).not.toHaveBeenCalled();
  });

  it('prefills and PATCHes on the update path (existing profile)', async () => {
    mockProfile(EXISTING_PROFILE);
    const user = userEvent.setup();
    renderForm('admin');

    // Prefilled from the existing profile.
    expect(screen.getByLabelText('First name')).toHaveValue('Ada');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    // EXISTING_PROFILE.document_type is 'OTHER' → label 'Other'.
    expect(
      screen.getByRole('combobox', { name: 'Document type' })
    ).toHaveTextContent('Other');

    await user.clear(screen.getByLabelText('Document number'));
    await user.type(screen.getByLabelText('Document number'), '555');
    await user.click(screen.getByTestId('billing-profile-submit'));

    await waitFor(() => expect(updateBillingProfile).toHaveBeenCalledTimes(1));
    expect(updateBillingProfile).toHaveBeenCalledWith(
      expect.objectContaining({ document_number: '555' })
    );
    expect(createBillingProfile).not.toHaveBeenCalled();
  });

  it('renders a read-only view for a non-admin member (no submit)', () => {
    mockProfile(EXISTING_PROFILE);
    renderForm('member');

    expect(screen.getByTestId('billing-profile-readonly')).toBeInTheDocument();
    expect(
      screen.queryByTestId('billing-profile-submit')
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
    // The profile values are still shown.
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('surfaces "a billing profile already exists" on a 409-on-create and refetches', async () => {
    mockProfile(null);
    createBillingProfile.mockRejectedValue({
      detail: 'a billing profile already exists',
    });
    const user = userEvent.setup();
    renderForm('admin');

    await fillCreateForm(user);
    await user.click(screen.getByTestId('billing-profile-submit'));

    expect(
      await screen.findByTestId('billing-profile-exists')
    ).toBeInTheDocument();
    expect(refetch).toHaveBeenCalled();
  });

  it('keeps the "already exists" banner across the 409-refetch remount (BLOCKER 1 regression)', async () => {
    mockProfile(null);
    createBillingProfile.mockRejectedValue({
      detail: 'a billing profile already exists',
    });
    const user = userEvent.setup();
    const { rerender } = renderForm('admin');

    await fillCreateForm(user);
    await user.click(screen.getByTestId('billing-profile-submit'));

    expect(
      await screen.findByTestId('billing-profile-exists')
    ).toBeInTheDocument();
    expect(refetch).toHaveBeenCalled();

    // Simulate the refetch resolving: the profile now exists. This flips
    // `billingProfile` null→real, which changes `BillingProfileEditor`'s
    // `key` and remounts it.
    mockProfile(EXISTING_PROFILE);
    rerender(
      <PermissionProvider permissions={permissionsFor('admin')}>
        <BillingProfileForm />
      </PermissionProvider>
    );

    // The editor re-initializes with the existing profile's values...
    expect(screen.getByLabelText('First name')).toHaveValue('Ada');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    // ...and the banner survives the remount (BLOCKER 1: `alreadyExists`
    // must live outside the keyed subtree).
    expect(screen.getByTestId('billing-profile-exists')).toBeInTheDocument();
  });

  it('shows the error toast (not "already exists") for a 403/429-shaped { detail } on create', async () => {
    mockProfile(null);
    // A 403 admin-gate / 429 throttle body also carries a `detail` — it must not
    // be misread as a profile-already-exists conflict.
    createBillingProfile.mockRejectedValue({
      detail: 'You do not have permission to perform this action.',
    });
    const user = userEvent.setup();
    renderForm('admin');

    await fillCreateForm(user);
    await user.click(screen.getByTestId('billing-profile-submit'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(
      screen.queryByTestId('billing-profile-exists')
    ).not.toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('PATCHes a cleared optional as "" on the update path so the clear persists', async () => {
    mockProfile(EXISTING_PROFILE);
    const user = userEvent.setup();
    renderForm('admin');

    // Blank the existing phone and save.
    expect(screen.getByLabelText('Phone (optional)')).toHaveValue(
      '+1 555 000 0000'
    );
    await user.clear(screen.getByLabelText('Phone (optional)'));
    await user.click(screen.getByTestId('billing-profile-submit'));

    await waitFor(() => expect(updateBillingProfile).toHaveBeenCalledTimes(1));
    // Sent as "" (not omitted) so the PATCH round-trips the clear.
    expect(updateBillingProfile).toHaveBeenCalledWith(
      expect.objectContaining({ contact_phone: '' })
    );
  });

  it('offers exactly the nine document-type enum values', async () => {
    mockProfile(null);
    const user = userEvent.setup();
    renderForm('admin');

    await user.click(screen.getByRole('combobox', { name: 'Document type' }));

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(9);
    expect(options.map((o) => o.textContent)).toEqual(
      DOCUMENT_TYPE_OPTIONS.map((o) => o.label)
    );
  });

  it('blocks submit when the document type is left unselected', async () => {
    mockProfile(null);
    const user = userEvent.setup();
    renderForm('admin');

    await user.type(screen.getByLabelText('First name'), 'Grace');
    await user.type(screen.getByLabelText('Email'), 'grace@example.com');
    await user.type(screen.getByLabelText('Document number'), '987654321');

    await user.click(screen.getByTestId('billing-profile-submit'));

    expect(
      await screen.findByText('Select a document type.')
    ).toBeInTheDocument();
    expect(createBillingProfile).not.toHaveBeenCalled();
  });

  it('still renders a legacy/out-of-enum document type in the read view', () => {
    mockProfile({
      ...EXISTING_PROFILE,
      // A value predating the enum — the read view must not force it through
      // the closed nine-value set (open on read, closed on write).
      document_type: 'tax_id' as unknown as BillingProfile['document_type'],
    });
    renderForm('member');

    expect(screen.getByText('tax_id')).toBeInTheDocument();
  });

  it('maps a server field-validation 400 (incl. nested billing_address) onto its fields', async () => {
    mockProfile(null);
    createBillingProfile.mockRejectedValue({
      document_number: ['Invalid.'],
      billing_address: { street_name: ['Required.'] },
    });
    const user = userEvent.setup();
    renderForm('admin');

    await fillCreateForm(user);
    await user.click(screen.getByTestId('billing-profile-submit'));

    expect(await screen.findByText('Invalid.')).toBeInTheDocument();
    expect(await screen.findByText('Required.')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId('billing-profile-exists')
    ).not.toBeInTheDocument();
  });

  it('shows a clear billing-permission message on a defensive 403 and writes nothing', async () => {
    mockProfile(null);
    // The mutation hooks attach the HTTP status to the thrown error body
    // (see use-create-billing-profile.ts) — the form discriminates on it,
    // not on DRF's English `detail` text.
    createBillingProfile.mockRejectedValue(
      Object.assign(
        { detail: 'You do not have permission to perform this action.' },
        { status: 403 }
      )
    );
    const user = userEvent.setup();
    renderForm('admin');

    await fillCreateForm(user);
    await user.click(screen.getByTestId('billing-profile-submit'));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'You need billing permission to do this',
        expect.objectContaining({
          description: 'Ask an organization admin to grant billing access.',
        })
      )
    );
    expect(
      screen.queryByTestId('billing-profile-exists')
    ).not.toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();
  });
});
