import type { Meta, StoryObj } from '../story-types';

import { SidebarItem } from './sidebar';

/**
 * SidebarItem — BINDING-ONLY story (`tags: ['!dev']`). A nav row is meaningless
 * outside a Sidebar; it is documented in the Sidebar story.
 *
 * Every prop is serializable — `iconName` is a registry KEY, not a component —
 * which is exactly what makes the sidebar composable in Puck.
 */
const meta = {
  title: 'Layout/SidebarItem',
  component: SidebarItem,
  tags: ['!dev'],
  argTypes: {
    label: { control: 'text' },
    iconName: {
      control: 'select',
      options: [
        'calendar',
        'calendar-days',
        'users',
        'settings',
        'bell',
        'clock',
        'user',
        'zap',
        'search',
        'shield-check',
      ],
      description: 'Icon registry key (see ui/icon-registry)',
    },
    href: { control: 'text', description: 'Renders as a link when set' },
    active: { control: 'boolean', description: 'Current-route styling' },
    badge: { control: 'text', description: 'Trailing count' },
  },
  args: { label: 'Bookings', iconName: 'calendar-days', badge: '8' },
} satisfies Meta<typeof SidebarItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
