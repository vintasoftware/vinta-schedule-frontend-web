import type { Meta, StoryObj } from '@storybook/react';
import { ServiceAccountCard } from './service-account-card';

const meta = {
  component: ServiceAccountCard,
  title: 'Sync / Service Account Card',
  tags: ['autodocs'],
} satisfies Meta<typeof ServiceAccountCard>;

export default meta;
type Story = StoryObj;

/**
 * The card as it appears when no service account has been configured yet.
 * Shows empty state and a "Configure" CTA.
 */
export const NotConfigured: Story = {};

/**
 * The card as it appears when a service account is already configured.
 * Shows email, audience, badge, and Rotate / Remove actions.
 */
export const Configured: Story = {};
