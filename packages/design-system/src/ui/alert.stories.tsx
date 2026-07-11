import type { Meta, StoryObj } from '../story-types';
import { CalendarClock, TriangleAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from './alert';

const meta = {
  title: 'Components/Alert',
  component: Alert,
  tags: ['autodocs'],
  // `variant` (cva, alert.tsx) is the only real scalar prop. Alert composes an
  // icon + AlertTitle + AlertDescription through `children`, so `children` is a
  // slot and must never also be an argTypes key (SLOT_ARGTYPE_COLLISION).
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'destructive'] },
  },
  args: { variant: 'default' },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Alert {...args} className='w-96'>
      <CalendarClock className='h-4 w-4' />
      <AlertTitle>Sync complete</AlertTitle>
      <AlertDescription>
        Your Google Calendar is up to date as of a moment ago.
      </AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  args: { variant: 'destructive' },
  render: (args) => (
    <Alert {...args} className='w-96'>
      <TriangleAlert className='h-4 w-4' />
      <AlertTitle>Booking conflict</AlertTitle>
      <AlertDescription>
        This slot overlaps an existing appointment. Pick another time.
      </AlertDescription>
    </Alert>
  ),
};
