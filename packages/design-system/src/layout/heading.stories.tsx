import type { Meta, StoryObj } from '../story-types';

import { Heading } from './heading';
import { VStack } from './flex';

const meta = {
  title: 'Layout/Heading',
  component: Heading,
  tags: ['autodocs'],
  // Leaf: the copy is editable text, so `children` is a text argType and NOT a
  // slot (a name may never be both — SLOT_ARGTYPE_COLLISION).
  argTypes: {
    children: { control: 'text', description: 'Heading copy' },
    level: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6],
      description: 'Sets the tag and the default size/weight',
    },
    size: {
      control: 'select',
      options: ['sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'],
    },
    weight: {
      control: 'select',
      options: ['normal', 'medium', 'semibold', 'bold', 'extrabold'],
    },
    color: {
      control: 'select',
      options: ['foreground', 'muted-foreground', 'primary', 'destructive'],
    },
    align: { control: 'inline-radio', options: ['left', 'center', 'right'] },
  },
  args: { children: 'Upcoming bookings', level: 2 },
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Levels: Story = {
  render: () => (
    <VStack gap={4}>
      <Heading level={1}>Level 1 — page title</Heading>
      <Heading level={2}>Level 2 — section</Heading>
      <Heading level={3}>Level 3 — subsection</Heading>
      <Heading level={4}>Level 4</Heading>
      <Heading level={5}>Level 5</Heading>
      <Heading level={6}>Level 6</Heading>
    </VStack>
  ),
};
