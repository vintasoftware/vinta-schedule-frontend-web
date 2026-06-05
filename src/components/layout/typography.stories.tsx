import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Text } from './text';
import { Heading } from './heading';
import { VStack } from './flex';

const meta = {
  title: 'Layout/Typography',
  component: Text,
  tags: ['autodocs'],
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Headings: Story = {
  render: () => (
    <VStack gap={4}>
      {[1, 2, 3, 4, 5, 6].map((l) => (
        <Heading key={l} level={l as 1}>
          Heading level {l}
        </Heading>
      ))}
    </VStack>
  ),
};

export const TextStyles: Story = {
  render: () => (
    <VStack gap={3}>
      <Text size='lg' color='muted-foreground'>
        Lead — reassuring, healthcare-aware copy.
      </Text>
      <Text>Body — the quick brown fox books an appointment at 9:00 AM.</Text>
      <Text size='sm' color='muted-foreground'>
        Small / caption text.
      </Text>
      <Text size='xs' weight='semibold' tracking='wide' uppercase color='muted-foreground'>
        Overline
      </Text>
      <Text family='mono' size='sm'>
        Geist Mono — 09:00–09:30 · ID a1b2c3
      </Text>
      <Text weight='bold' color='primary'>
        Emphasis in brand color.
      </Text>
    </VStack>
  ),
};
