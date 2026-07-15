import type { Meta, StoryObj } from '@storybook/react-vite';

import { Center } from './center';
import { Text } from './text';

const meta = {
  title: 'Layout/Center',
  component: Center,
  tags: ['autodocs'],
  argTypes: {
    minHeight: {
      control: 'text',
      description: "Sizes the centering area (e.g. 240, '100%', 'screen')",
    },
    gap: { control: 'select', options: [0, 1, 2, 3, 4, 6, 8] },
    p: { control: 'select', options: [0, 2, 4, 6, 8, 12] },
    bg: {
      control: 'select',
      options: ['background', 'card', 'muted', 'accent'],
    },
    radius: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'],
    },
    direction: { control: 'inline-radio', options: ['row', 'column'] },
  },
  args: { minHeight: 200, bg: 'muted', radius: 'lg' },
} satisfies Meta<typeof Center>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Center {...args}>
      <Text color='muted-foreground'>Centered on both axes</Text>
    </Center>
  ),
};

/** The empty-state idiom: a centered column of copy inside a sized area. */
export const EmptyState: Story = {
  args: { minHeight: 240, direction: 'column', gap: 2, bg: 'card' },
  render: (args) => (
    <Center {...args}>
      <Text weight='semibold'>No bookings yet</Text>
      <Text size='sm' color='muted-foreground'>
        New appointments will appear here.
      </Text>
    </Center>
  ),
};
