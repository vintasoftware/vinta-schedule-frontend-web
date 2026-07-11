import type { Meta, StoryObj } from '../story-types';

import { Avatar, AvatarFallback, AvatarImage } from './avatar';

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  // Radix's Avatar root (`AvatarProps extends PrimitiveSpanProps`) declares no
  // props of its own: `src`/`alt` belong to AvatarImage and the initials belong
  // to AvatarFallback — both composed through the `children` slot (§3). The one
  // real, forwarded scalar left on the root is its accessible name.
  // `className`/`style` stay unexposed (§6).
  argTypes: {
    'aria-label': {
      control: 'text',
      description: 'Accessible name for the avatar',
    },
  },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { 'aria-label': 'Dr. Lopez' },
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src='https://i.pravatar.cc/80?img=12' alt='Dr. Lopez' />
      <AvatarFallback>DL</AvatarFallback>
    </Avatar>
  ),
};

export const Fallback: Story = {
  args: { 'aria-label': 'Jane Doe' },
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
};

export const Group: Story = {
  render: () => (
    <div className='flex -space-x-2'>
      {['1', '5', '9', '12'].map((i) => (
        <Avatar key={i} className='ring-background ring-2'>
          <AvatarImage src={`https://i.pravatar.cc/80?img=${i}`} alt='' />
          <AvatarFallback>U{i}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
};
