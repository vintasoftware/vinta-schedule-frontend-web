import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Avatar, AvatarFallback, AvatarImage } from './avatar';

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
  tags: ['autodocs'],
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src='https://i.pravatar.cc/80?img=12' alt='Dr. Lopez' />
      <AvatarFallback>DL</AvatarFallback>
    </Avatar>
  ),
};

export const Fallback: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
};

export const Group: Story = {
  render: () => (
    <div className='flex -space-x-2'>
      {['1', '5', '9', '12'].map((i) => (
        <Avatar key={i} className='ring-2 ring-background'>
          <AvatarImage src={`https://i.pravatar.cc/80?img=${i}`} alt='' />
          <AvatarFallback>U{i}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
};
