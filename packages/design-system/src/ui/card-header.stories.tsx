import type { Meta, StoryObj } from '../story-types';

import { Card, CardHeader, CardTitle } from './card';

/**
 * CardHeader — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a card header only means something inside a Card.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose CardHeader.
 */
const meta = {
  title: 'Components/CardHeader',
  component: CardHeader,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof CardHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card padding={0}>
      <CardHeader>
        <CardTitle>Annual checkup</CardTitle>
      </CardHeader>
    </Card>
  ),
};
