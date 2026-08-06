import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrandingForm } from './branding-form';

// ---------------------------------------------------------------------------
// Decorator — provides a QueryClient (required by useUpdateBranding → useMutation)
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

const meta = {
  title: 'Components/BrandingForm',
  component: BrandingForm,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [withQueryClient],
} satisfies Meta<typeof BrandingForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Empty form — first-time configuration. No slug set yet; the live preview uses
 * the fallback placeholder text ("Your App").
 */
export const Empty: Story = {
  args: {
    initialBranding: null,
    initialSlug: null,
  },
};

/**
 * Prefilled form — shows how the form looks when the org already has a branding
 * configuration and a public slug.
 */
export const Prefilled: Story = {
  args: {
    initialSlug: 'myscheduler',
    initialBranding: {
      app_name: 'MyScheduler',
      logo_url: 'https://placehold.co/120x40/1B4DFF/white?text=Logo',
      primary_color: '#1B4DFF',
      secondary_color: '#0D1F6B',
      support_email: 'support@myscheduler.example.com',
      redirect_url: 'https://myscheduler.example.com/dashboard',
    },
  },
};

/**
 * Slug-less eligible org — branding fields empty, slug field ready for first set.
 */
export const SluglessOrg: Story = {
  args: {
    initialBranding: null,
    initialSlug: null,
  },
};

/**
 * Mobile viewport variant — verifies the responsive layout (form + preview
 * stack vertically on small screens).
 */
export const Mobile: Story = {
  args: {
    initialBranding: null,
    initialSlug: null,
  },
  globals: { viewport: { value: 'mobile' } },
};
