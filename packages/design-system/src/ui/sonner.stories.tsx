import type { Meta, StoryObj } from '../story-types';
import { toast } from 'sonner';

import { Toaster } from './sonner';
import { Button } from './button';

const meta = {
  // Title leaf must match the real named export — the component is `Toaster`,
  // so the old 'Components/Sonner (Toast)' leaf was invalid (§7).
  title: 'Components/Toaster',
  component: Toaster,
  tags: ['autodocs'],
  // Leaf: sonner's ToasterProps. It renders the toast viewport, never composed
  // children → no slot (§4). `className`/`style` are excluded (§6).
  argTypes: {
    position: {
      control: 'select',
      options: [
        'top-left',
        'top-center',
        'top-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
      ],
    },
    theme: { control: 'inline-radio', options: ['light', 'dark', 'system'] },
    richColors: { control: 'boolean' },
    closeButton: { control: 'boolean' },
    expand: { control: 'boolean' },
    duration: { control: 'number', description: 'Toast lifetime in ms' },
  },
  args: { position: 'bottom-right', richColors: false, closeButton: false },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
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
      <Toaster {...args} />
    </div>
  ),
};
