import type { Meta, StoryObj } from '../story-types';

import { Skeleton } from './skeleton';

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  // Skeleton is a bare styled div (`React.HTMLAttributes<HTMLDivElement>`) — it
  // has NO domain prop of its own: size/shape are driven purely by className,
  // which must never be exposed (§6). Nothing was fabricated; the only real,
  // forwarded scalar worth editing is the accessible loading label. It renders
  // no composed content → no slot (§4).
  argTypes: {
    'aria-label': {
      control: 'text',
      description: 'Accessible label announced while content loads',
    },
  },
  args: { 'aria-label': 'Loading' },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <Skeleton className='h-6 w-48' {...args} />,
};

export const Card: Story = {
  render: () => (
    <div className='flex w-80 items-center gap-4'>
      <Skeleton className='h-12 w-12 rounded-full' />
      <div className='flex-1 space-y-2'>
        <Skeleton className='h-4 w-3/4' />
        <Skeleton className='h-4 w-1/2' />
      </div>
    </div>
  ),
};
