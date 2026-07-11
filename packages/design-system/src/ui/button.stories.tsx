import type { Meta, StoryObj } from '../story-types';
import { CalendarPlus, Loader2 } from 'lucide-react';

import { Button } from './button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    // `children` is the button label — a plain editable string here (a leaf,
    // not a slot). `className`/`style` are deliberately NOT exposed (§6).
    children: { control: 'text', description: 'Button label' },
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'destructive',
        'outline',
        'ghost',
        'link',
      ],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'default', 'lg', 'xl', 'icon'],
    },
    disabled: { control: 'boolean' },
  },
  args: { children: 'Book appointment', variant: 'default', size: 'default' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-3'>
      <Button>Default</Button>
      <Button variant='secondary'>Secondary</Button>
      <Button variant='destructive'>Destructive</Button>
      <Button variant='outline'>Outline</Button>
      <Button variant='ghost'>Ghost</Button>
      <Button variant='link'>Link</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-3'>
      <Button size='xs'>Extra small</Button>
      <Button size='sm'>Small</Button>
      <Button size='default'>Default</Button>
      <Button size='lg'>Large</Button>
      <Button size='xl'>Extra large</Button>
      <Button size='icon' aria-label='Add'>
        <CalendarPlus />
      </Button>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <Button>
      <CalendarPlus />
      New booking
    </Button>
  ),
};

export const Loading: Story = {
  render: () => (
    <Button disabled>
      <Loader2 className='animate-spin' />
      Syncing…
    </Button>
  ),
};

export const Disabled: Story = { args: { disabled: true } };
