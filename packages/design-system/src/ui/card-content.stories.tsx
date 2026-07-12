import type { Meta, StoryObj } from '../story-types';

import { Card, CardContent } from './card';
import { Text } from '../layout/text';

/**
 * CardContent — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: card content only means something inside a Card.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose CardContent.
 */
const meta = {
  title: 'Components/CardContent',
  component: CardContent,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof CardContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card padding={0}>
      <CardContent>
        <Text>Body copy</Text>
      </CardContent>
    </Card>
  ),
};
