import type { Meta, StoryObj } from '../story-types';

import { Card, CardHeader, CardDescription } from './card';

/**
 * CardDescription — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a card description only means something inside a Card.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose CardDescription.
 */
const meta = {
  title: 'Components/CardDescription',
  component: CardDescription,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Copy' },
  },
  args: { children: 'Dr. Lopez' },
} satisfies Meta<typeof CardDescription>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card padding={0}>
      <CardHeader>
        <CardDescription>Dr. Lopez</CardDescription>
      </CardHeader>
    </Card>
  ),
};
