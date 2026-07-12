import type { Meta, StoryObj } from '../story-types';

import { Skeleton } from './skeleton';

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  // Leaf component — renders no composed content, so NO slot (§4). The curated
  // controls are the real, forwarded sizing props: `width`/`height` resolve
  // through layout-style's `resolveSize` (number → px, or any CSS length),
  // `radius` is the DS token scale, `shape` drives circle/text presets.
  // `className`/`style` stay unexposed (§6).
  argTypes: {
    width: { control: 'text' },
    height: { control: 'text' },
    radius: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'],
    },
    shape: { control: 'inline-radio', options: ['rect', 'circle', 'text'] },
  },
  args: { width: 192, height: 24, shape: 'rect' },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <Skeleton {...args} />,
};

/** `shape='circle'` forces a full radius and a 1:1 aspect ratio. */
export const Circle: Story = {
  args: { width: 48, height: undefined, shape: 'circle' },
  render: (args) => <Skeleton {...args} />,
};

/** `shape='text'` defaults the height to one line of text. */
export const TextLines: Story = {
  args: { shape: 'text', width: '100%', height: undefined },
  render: (args) => (
    <div className='w-80 space-y-2'>
      <Skeleton {...args} />
      <Skeleton {...args} width='75%' />
      <Skeleton {...args} width='50%' />
    </div>
  ),
};

/** A card placeholder composed purely from props — no size classes. */
export const Card: Story = {
  args: { radius: 'lg' },
  render: (args) => (
    <div className='flex w-80 items-center gap-4'>
      <Skeleton shape='circle' width={48} />
      <div className='flex-1 space-y-2'>
        <Skeleton {...args} shape='text' width='75%' />
        <Skeleton {...args} shape='text' width='50%' />
      </div>
    </div>
  ),
};
