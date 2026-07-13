import type { Meta, StoryObj } from '../story-types';

import { Avatar, AvatarFallback } from './avatar';

/**
 * AvatarFallback — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a fallback only
 * means something inside Avatar. The contract extractor still reads it (it
 * only looks at title / argTypes / parameters.puck), so the composer can
 * bind and compose AvatarFallback.
 */
const meta = {
  title: 'Components/AvatarFallback',
  component: AvatarFallback,
  tags: ['!dev'],
  // Leaf: holds only text (initials), no composed children -> no slot (§9).
  argTypes: {
    children: { control: 'text', description: 'Fallback initials or text' },
  },
  args: { children: 'DL' },
} satisfies Meta<typeof AvatarFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Avatar>
      <AvatarFallback {...args} />
    </Avatar>
  ),
};
