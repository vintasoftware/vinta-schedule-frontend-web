import type { Meta, StoryObj } from '@storybook/react-vite';

import { VisuallyHidden } from './visually-hidden';
import { Button } from '../ui/button';
import { Text } from './text';
import { VStack } from './flex';

const meta = {
  title: 'Layout/VisuallyHidden',
  component: VisuallyHidden,
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: 'text',
      description: 'Copy exposed to screen readers but not shown visually',
    },
    as: {
      control: 'inline-radio',
      options: ['span', 'div', 'h2'],
      description: 'Element to render',
    },
  },
  args: { children: 'Close dialog', as: 'span' },
} satisfies Meta<typeof VisuallyHidden>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Nothing renders visually — that is the point. The text is in the a11y tree.
 */
export const Default: Story = {
  render: (args) => (
    <VStack gap={2}>
      <Text size='sm' color='muted-foreground'>
        There is a visually hidden string below this line.
      </Text>
      <VisuallyHidden {...args} />
    </VStack>
  ),
};

/** The usual job: giving an icon-only control an accessible name. */
export const AccessibleName: Story = {
  render: () => (
    <Button size='icon'>
      <span aria-hidden>×</span>
      <VisuallyHidden>Dismiss notification</VisuallyHidden>
    </Button>
  ),
};
