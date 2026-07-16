import type { Meta, StoryObj } from '@storybook/react-vite';

import { Section } from './section';
import { Heading } from './heading';
import { Text } from './text';
import { VStack } from './flex';

const meta = {
  title: 'Layout/Section',
  component: Section,
  tags: ['autodocs'],
  argTypes: {
    py: {
      control: 'select',
      options: [0, 4, 6, 8, 12, 16, 20, 24],
      description: 'Vertical rhythm between page sections (default 16 = 64px)',
    },
    bg: {
      control: 'select',
      options: ['background', 'card', 'muted', 'accent'],
    },
    borderTop: { control: 'boolean' },
    borderBottom: { control: 'boolean' },
    textAlign: {
      control: 'inline-radio',
      options: ['left', 'center', 'right'],
    },
  },
  args: { py: 16 },
} satisfies Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Section {...args}>
      <VStack gap={2}>
        <Heading level={2}>Availability</Heading>
        <Text color='muted-foreground'>
          Set the hours you are open for bookings.
        </Text>
      </VStack>
    </Section>
  ),
};

/** Banded sections: alternate the surface and rule them off with borderTop. */
export const Banded: Story = {
  render: () => (
    <>
      <Section py={12}>
        <Heading level={2}>First band</Heading>
      </Section>
      <Section py={12} bg='muted' borderTop>
        <Heading level={2}>Second band</Heading>
      </Section>
    </>
  ),
};
