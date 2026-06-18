import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BrandingPreview } from './branding-preview';

const meta = {
  title: 'Components/BrandingPreview',
  component: BrandingPreview,
  tags: ['autodocs'],
  args: {
    appName: 'MyScheduler',
  },
} satisfies Meta<typeof BrandingPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default — no custom colors, just an app name. Uses the design-system primary
 * color token for buttons and the header strip.
 */
export const Default: Story = {};

/**
 * Branded — primary and secondary colors provided; the header and buttons
 * reflect the reseller's brand palette.
 */
export const Branded: Story = {
  args: {
    appName: 'MyScheduler',
    primaryColor: '#1B4DFF',
    secondaryColor: '#ffffff',
    logoUrl: 'https://placehold.co/120x40/1B4DFF/white?text=Logo',
  },
};

/**
 * Custom palette — demonstrates a different brand color to show the preview
 * updates dynamically as the reseller types in the form.
 */
export const CustomPalette: Story = {
  args: {
    appName: 'TealApp',
    primaryColor: '#0D9488',
    secondaryColor: '#f0fdfa',
  },
};

/**
 * No logo — preview with no logo URL falls back to a placeholder block.
 */
export const NoLogo: Story = {
  args: {
    appName: 'MyScheduler',
    primaryColor: '#7C3AED',
  },
};
