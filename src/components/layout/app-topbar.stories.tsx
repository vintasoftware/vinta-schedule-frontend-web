import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CalendarPlus } from 'lucide-react';

import { AppTopbar } from './app-topbar';
import { Button } from '@/components/ui/button';

const meta = {
  title: 'Composition/AppTopbar',
  component: AppTopbar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { title: 'Calendar', subtitle: 'This week · 3 bookings' },
} satisfies Meta<typeof AppTopbar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Collapses to an icon button at narrow topbar widths.
const NewBookingAction = () => (
  <>
    <Button
      size='icon'
      aria-label='New booking'
      className='shrink-0 @3xl/topbar:hidden'
    >
      <CalendarPlus />
    </Button>
    <Button size='sm' className='hidden shrink-0 @3xl/topbar:inline-flex'>
      <CalendarPlus />
      New booking
    </Button>
  </>
);

export const Default: Story = {
  render: (args) => <AppTopbar {...args} actions={<NewBookingAction />} />,
};

export const Syncing: Story = {
  args: { sync: 'syncing', subtitle: 'Refreshing connected calendars' },
  render: (args) => <AppTopbar {...args} />,
};

export const NoSearch: Story = {
  args: { showSearch: false, sync: null },
  render: (args) => <AppTopbar {...args} />,
};

// At narrow widths: search → icon button, action → icon button, sync pill
// stays. Title shrinks.
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile' } },
  render: (args) => <AppTopbar {...args} actions={<NewBookingAction />} />,
};
