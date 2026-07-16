import type { Meta, StoryObj } from '@storybook/react-vite';

import { Divider } from './divider';
import { Box, HStack, VStack } from './index';
import { Text } from './text';

const meta = {
  title: 'Layout/Divider',
  component: Divider,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'inline-radio',
      options: ['horizontal', 'vertical'],
    },
    tone: {
      control: 'select',
      options: ['border', 'muted', 'primary', 'destructive'],
      description: 'Line color token',
    },
    spacing: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 6, 8],
      description: 'Space around the line, on the 4px scale',
    },
  },
  args: { orientation: 'horizontal', spacing: 4 },
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: (args) => (
    <VStack>
      <Text>Above the rule</Text>
      <Divider {...args} />
      <Text>Below the rule</Text>
    </VStack>
  ),
};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  render: (args) => (
    <HStack height={40}>
      <Text>Left</Text>
      <Divider {...args} />
      <Text>Right</Text>
    </HStack>
  ),
};

/** Prefer the `borderTop`/`borderBottom` box props for a rule that belongs to a
 *  surface; use Divider when the rule is a standalone separator. */
export const Tones: Story = {
  render: () => (
    <VStack gap={2}>
      <Box>
        <Divider tone='border' />
        <Divider tone='primary' />
        <Divider tone='destructive' />
      </Box>
    </VStack>
  ),
};
