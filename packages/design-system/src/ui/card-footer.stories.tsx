import type { Meta, StoryObj } from '../story-types';

import { Card, CardFooter } from './card';
import { Text } from '../layout/text';

/**
 * CardFooter — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a card footer only means something inside a Card.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose CardFooter.
 */
const meta = {
  title: 'Components/CardFooter',
  component: CardFooter,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof CardFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card padding={0}>
      <CardFooter>
        <Text>Footer</Text>
      </CardFooter>
    </Card>
  ),
};
