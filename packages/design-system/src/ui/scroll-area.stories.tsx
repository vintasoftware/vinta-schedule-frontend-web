import type { Meta, StoryObj } from '@storybook/react-vite';

import { ScrollArea } from './scroll-area';

const meta = {
  title: 'Components/ScrollArea',
  component: ScrollArea,
  tags: ['autodocs'],
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const slots = Array.from({ length: 24 }, (_, i) => {
  const h = 8 + Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

export const Default: Story = {
  render: () => (
    <ScrollArea className='h-64 w-56 rounded-md border'>
      <div className='p-3'>
        <p className='mb-2 text-sm font-medium'>Available slots</p>
        {slots.map((s) => (
          <div
            key={s}
            className='hover:bg-accent rounded px-2 py-1.5 font-mono text-sm'
          >
            {s}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};
