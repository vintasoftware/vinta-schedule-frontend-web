import type { Meta, StoryObj } from '../story-types';

import { Image } from './image';

const SAMPLE =
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=640&q=80';

const meta = {
  title: 'Components/Image',
  component: Image,
  tags: ['autodocs'],
  // Leaf component with no children — no slots (§5). `alt` is a required prop,
  // so it is exposed as an editable string rather than hidden.
  argTypes: {
    src: { control: 'text' },
    alt: { control: 'text', description: 'Required; "" for decorative images' },
    radius: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'],
    },
    fit: {
      control: 'select',
      options: ['cover', 'contain', 'fill', 'none', 'scale-down'],
    },
    width: { control: 'number' },
    height: { control: 'number' },
  },
  args: {
    src: SAMPLE,
    alt: 'A tidy desk with a laptop and a coffee cup',
    radius: 'lg',
    fit: 'cover',
    width: 320,
    height: 200,
  },
} satisfies Meta<typeof Image>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Radii: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-4'>
      <Image src={SAMPLE} alt='' radius='none' width={120} height={120} />
      <Image src={SAMPLE} alt='' radius='md' width={120} height={120} />
      <Image src={SAMPLE} alt='' radius='2xl' width={120} height={120} />
      <Image src={SAMPLE} alt='' radius='full' width={120} height={120} />
    </div>
  ),
};

export const Fit: Story = {
  name: 'Object fit',
  render: () => (
    <div className='flex flex-wrap items-center gap-4'>
      <Image src={SAMPLE} alt='' fit='cover' width={160} height={110} />
      <Image src={SAMPLE} alt='' fit='contain' width={160} height={110} />
      <Image src={SAMPLE} alt='' fit='fill' width={160} height={110} />
    </div>
  ),
};

export const Avatarish: Story = {
  name: 'Round profile photo',
  render: () => (
    <Image
      src={SAMPLE}
      alt='Profile photo'
      radius='full'
      fit='cover'
      width={64}
      height={64}
    />
  ),
};
