import type { Meta, StoryObj } from '../story-types';

import { Card, CardHeader, CardTitle } from './card';

/**
 * CardTitle — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a card title only means something inside a Card.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose CardTitle.
 */
const meta = {
  title: 'Components/CardTitle',
  component: CardTitle,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Copy' },
  },
  args: { children: 'Annual checkup' },
} satisfies Meta<typeof CardTitle>;

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
