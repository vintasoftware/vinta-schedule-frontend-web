import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarClock, TriangleAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from './alert';

const meta = {
  title: 'Components/Alert',
  component: Alert,
  tags: ['autodocs'],
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Alert className='w-96'>
      <CalendarClock className='h-4 w-4' />
      <AlertTitle>Sync complete</AlertTitle>
      <AlertDescription>
        Your Google Calendar is up to date as of a moment ago.
      </AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant='destructive' className='w-96'>
      <TriangleAlert className='h-4 w-4' />
      <AlertTitle>Booking conflict</AlertTitle>
      <AlertDescription>
        This slot overlaps an existing appointment. Pick another time.
      </AlertDescription>
    </Alert>
  ),
};
