import type { Meta, StoryObj } from '@storybook/react-vite';

import { Spinner } from './spinner';

const meta = {
  title: 'Components/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      description:
        'Token size: xs 12px · sm 16px · md 20px · lg 24px · xl 32px',
    },
    color: {
      control: 'select',
      options: [
        'foreground',
        'muted-foreground',
        'primary',
        'primary-foreground',
        'destructive',
      ],
      description: 'Design-token color; inherits the text color when unset',
    },
    label: {
      control: 'text',
      description:
        'Announced name (role="status"); empty makes it decorative for e.g. a button that already says "Saving…"',
    },
  },
  args: { size: 'sm', color: 'foreground', label: 'Loading' },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className='flex items-center gap-4'>
      <Spinner size='xs' />
      <Spinner size='sm' />
      <Spinner size='md' />
      <Spinner size='lg' />
      <Spinner size='xl' />
    </div>
  ),
};

export const OnMutedText: Story = {
  args: { size: 'md', color: 'muted-foreground', label: 'Loading bookings' },
};

/** Inside a pending button the surrounding label already announces the state. */
export const Decorative: Story = {
  args: { size: 'sm', label: '' },
};
