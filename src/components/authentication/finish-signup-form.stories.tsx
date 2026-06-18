import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FinishSignupForm } from './finish-signup-form';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';

// ---------------------------------------------------------------------------
// Decorator — provides a QueryClient (required by useProviderInfo /
// useProviderSignup hooks inside the form)
// ---------------------------------------------------------------------------

function withQueryClient(Story: React.ComponentType) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Story />
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/Authentication/FinishSignupForm',
  component: FinishSignupForm,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [withQueryClient],
} satisfies Meta<typeof FinishSignupForm>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Vinta default branding — renders byte-for-byte as today's finish-signup page. */
export const VintaDefault: Story = {
  args: {
    branding: VINTA_DEFAULT_BRANDING,
  },
};

/** Reseller branding — shows a custom logo and app name in the navbar. */
export const BrandedTenant: Story = {
  args: {
    branding: {
      appName: 'Acme Corp',
      logoUrl: 'https://placehold.co/120x20/4f46e5/ffffff?text=Acme+Corp',
      primaryColor: '#4f46e5',
      secondaryColor: '#7c3aed',
    },
  },
};

/** Vinta default at mobile viewport. */
export const VintaDefaultMobile: Story = {
  args: {
    branding: VINTA_DEFAULT_BRANDING,
  },
  globals: { viewport: { value: 'mobile' } },
};

/** Branded tenant at mobile viewport. */
export const BrandedTenantMobile: Story = {
  args: {
    branding: {
      appName: 'Acme Corp',
      logoUrl: 'https://placehold.co/120x20/4f46e5/ffffff?text=Acme+Corp',
      primaryColor: '#4f46e5',
      secondaryColor: '#7c3aed',
    },
  },
  globals: { viewport: { value: 'mobile' } },
};
