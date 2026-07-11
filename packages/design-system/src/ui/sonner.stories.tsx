import type { Meta, StoryObj } from '@storybook/react-vite';
import { toast } from 'sonner';

import { Toaster } from './sonner';
import { Button } from './button';

const meta = {
  title: 'Components/Sonner (Toast)',
  component: Toaster,
  tags: ['autodocs'],
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className='flex flex-wrap gap-3'>
      <Button onClick={() => toast('Booking saved')}>Default</Button>
      <Button
        variant='outline'
        onClick={() =>
          toast.success('Appointment confirmed', {
            description: 'Mon, 9:00–9:30 AM with Dr. Lopez',
          })
        }
      >
        Success
      </Button>
      <Button
        variant='destructive'
        onClick={() => toast.error('Sync failed — retrying')}
      >
        Error
      </Button>
      <Toaster />
    </div>
  ),
};
