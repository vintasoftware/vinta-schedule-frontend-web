import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Text } from 'vinta-schedule-design-system/layout';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';
import type { TenantBranding } from '@/lib/branding-shared';
import { PublicBookingShell } from './public-booking-shell';

const RESELLER_BRANDING: TenantBranding = {
  appName: 'Acme Scheduling',
  logoUrl: 'https://placehold.co/120x32?text=Acme',
  primaryColor: '#1A73E8',
  secondaryColor: '#FBBC04',
};

const meta = {
  title: 'Components/PublicBooking/PublicBookingShell',
  component: PublicBookingShell,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    branding: VINTA_DEFAULT_BRANDING,
    children: <Text>Page content goes here.</Text>,
  },
} satisfies Meta<typeof PublicBookingShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default (vinta) branding — the bare `/book/[code]` route. */
export const DefaultBranding: Story = {};

/** Reseller branding — the branded `/o/[slug]/book/[code]` route. */
export const RebrandedOrganization: Story = {
  args: { branding: RESELLER_BRANDING },
};
