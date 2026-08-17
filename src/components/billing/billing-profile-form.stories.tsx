import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { Box } from 'vinta-schedule-design-system/layout';

import type { BillingProfile, RoleEnum } from '@/client';
import { billingProfileRetrieveBillingProfileRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import { RoleProvider } from '@/components/navigation/role-gate';

import { BillingProfileForm } from './billing-profile-form';

const PROFILE: BillingProfile = {
  id: 1,
  contact_first_name: 'Ada',
  contact_last_name: 'Lovelace',
  contact_email: 'ada@example.com',
  contact_phone: '+1 555 000 0000',
  document_type: 'SSN',
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

function SeededForm({
  profile,
  role,
}: {
  profile: BillingProfile | null;
  role: RoleEnum;
}) {
  const [client] = useState(() => {
    const c = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // Seed the profile read so the form settles without a real backend call —
    // `null` drives the empty create form, a profile drives the prefilled edit.
    c.setQueryData(
      billingProfileRetrieveBillingProfileRetrieveOptions().queryKey,
      // A `null` seed (runtime) drives the empty create form; the DataTag'd key
      // types the value as non-null, so cast at this story-only boundary.
      profile as unknown as BillingProfile
    );
    return c;
  });
  return (
    <QueryClientProvider client={client}>
      <RoleProvider role={role}>
        <Box className='w-full max-w-2xl'>
          <BillingProfileForm />
        </Box>
      </RoleProvider>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Components/Billing/BillingProfileForm',
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** No profile yet — an admin sees the empty create form. */
export const CreateAsAdmin: Story = {
  render: () => <SeededForm profile={null} role='admin' />,
};

/** An existing profile — prefilled edit form for an admin. */
export const EditAsAdmin: Story = {
  render: () => <SeededForm profile={PROFILE} role='admin' />,
};

/** A non-admin member sees the profile values read-only. */
export const ReadOnlyMember: Story = {
  render: () => <SeededForm profile={PROFILE} role='member' />,
};

export const Mobile: Story = {
  render: () => <SeededForm profile={PROFILE} role='admin' />,
  globals: { viewport: { value: 'mobile' } },
};
