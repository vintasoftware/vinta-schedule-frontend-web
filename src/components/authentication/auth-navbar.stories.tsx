import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AuthNavbar } from './auth-navbar';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding';

const meta = {
  title: 'Components/AuthNavbar',
  component: AuthNavbar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    branding: VINTA_DEFAULT_BRANDING,
  },
} satisfies Meta<typeof AuthNavbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default vinta branding — renders byte-for-byte as today's auth navbar. */
export const VintaDefault: Story = {
  args: {
    branding: VINTA_DEFAULT_BRANDING,
  },
};

/** Reseller branding — shows a custom logo and hides the "Schedule" suffix. */
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

/** Default branding at mobile viewport — verifies responsive collapse. */
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
