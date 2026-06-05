import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Check, Clock, TriangleAlert, Video } from 'lucide-react';

import { Badge, BadgeDot } from './badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'destructive',
        'outline',
        'info',
        'success',
        'warning',
        'danger',
        'teal',
      ],
    },
  },
  args: { children: 'Confirmed' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Solid: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-2'>
      <Badge>Pro</Badge>
      <Badge variant='secondary'>Secondary</Badge>
      <Badge variant='destructive'>Conflict</Badge>
      <Badge variant='outline'>Virtual</Badge>
    </div>
  ),
};

export const SoftColors: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-2'>
      <Badge variant='info'>Calendar group</Badge>
      <Badge variant='success'>Synced</Badge>
      <Badge variant='warning'>Tentative</Badge>
      <Badge variant='danger'>Conflict</Badge>
      <Badge variant='teal'>42 available</Badge>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-2'>
      <Badge variant='success'>
        <Check />
        Confirmed
      </Badge>
      <Badge variant='warning'>
        <Clock />
        Pending
      </Badge>
      <Badge variant='danger'>
        <TriangleAlert />
        Conflict
      </Badge>
      <Badge variant='outline'>
        <Video />
        Telehealth
      </Badge>
    </div>
  ),
};

export const WithStatusDot: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-2'>
      <Badge variant='success'>
        <BadgeDot />
        Synced
      </Badge>
      <Badge variant='warning'>
        <BadgeDot />
        Tentative
      </Badge>
      <Badge variant='danger'>
        <BadgeDot />
        Conflict
      </Badge>
      <Badge variant='info'>
        <BadgeDot />
        Booked
      </Badge>
    </div>
  ),
};
