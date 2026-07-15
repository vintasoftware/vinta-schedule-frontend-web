import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bell, Calendar, Check, Clock, Trash2, Video } from 'lucide-react';

import { Icon } from './icon';
import { ICON_NAMES } from './icon-registry';

const meta = {
  title: 'Components/Icon',
  component: Icon,
  tags: ['autodocs'],
  argTypes: {
    name: {
      control: 'select',
      options: ICON_NAMES,
      description: 'Icon to render (registry key)',
    },
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
        'destructive',
        'success',
        'warning',
        'vinta-600',
      ],
      description: 'Design-token color; inherits the text color when unset',
    },
    spin: { control: 'boolean', description: 'Spin the glyph' },
    label: {
      control: 'text',
      description: 'Accessible name; decorative (aria-hidden) when empty',
    },
  },
  args: { name: 'calendar', size: 'sm', color: 'foreground', spin: false },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className='flex items-center gap-4'>
      <Icon icon={Calendar} size='xs' />
      <Icon icon={Calendar} size='sm' />
      <Icon icon={Calendar} size='md' />
      <Icon icon={Calendar} size='lg' />
      <Icon icon={Calendar} size='xl' />
    </div>
  ),
};

export const Colors: Story = {
  render: () => (
    <div className='flex items-center gap-4'>
      <Icon icon={Check} size='md' color='success' />
      <Icon icon={Clock} size='md' color='warning' />
      <Icon icon={Trash2} size='md' color='destructive' />
      <Icon icon={Video} size='md' color='vinta-600' />
      <Icon icon={Bell} size='md' color='muted-foreground' />
    </div>
  ),
};

export const Labelled: Story = {
  args: { icon: Bell, size: 'md', label: 'Notifications' },
};
