import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BrandingForm } from './branding-form';

const meta = {
  title: 'Components/BrandingForm',
  component: BrandingForm,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof BrandingForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Empty form — first-time configuration. The live preview uses the fallback
 * placeholder text ("Your App") and the app's default primary color.
 */
export const Empty: Story = {
  args: {
    initialBranding: null,
  },
};

/**
 * Prefilled form — shows how the form looks when the org already has a branding
 * configuration. The live preview reflects the saved colors and app name.
 */
export const Prefilled: Story = {
  args: {
    initialBranding: {
      app_name: 'MyScheduler',
      logo_url: 'https://placehold.co/120x40/1B4DFF/white?text=Logo',
      primary_color: '#1B4DFF',
      secondary_color: '#0D1F6B',
      support_email: 'support@myscheduler.example.com',
      return_url_allowlist: [
        'https://myscheduler.example.com/auth/callback',
        'https://staging.myscheduler.example.com/auth/callback',
      ],
    },
  },
};

/**
 * Mobile viewport variant — verifies the responsive layout (form + preview
 * stack vertically on small screens).
 */
export const Mobile: Story = {
  args: {
    initialBranding: null,
  },
  globals: { viewport: { value: 'mobile' } },
};
