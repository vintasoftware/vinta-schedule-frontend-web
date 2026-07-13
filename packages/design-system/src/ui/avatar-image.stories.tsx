import type { Meta, StoryObj } from '../story-types';

import { Avatar, AvatarImage } from './avatar';

/**
 * AvatarImage — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an avatar image
 * only means something inside Avatar (it must find the root's loading
 * context to know whether to render). The contract extractor still reads it
 * (it only looks at title / argTypes / parameters.puck), so the composer can
 * bind and compose AvatarImage.
 */
const meta = {
  title: 'Components/AvatarImage',
  component: AvatarImage,
  tags: ['!dev'],
  // Leaf: renders an <img>, no composed children — src/alt are its real props.
  argTypes: {
    src: { control: 'text', description: 'Image URL' },
    alt: { control: 'text', description: 'Accessible alt text' },
  },
  args: {},
} satisfies Meta<typeof AvatarImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { src: 'https://i.pravatar.cc/80?img=12', alt: 'Dr. Lopez' },
  render: (args) => (
    <Avatar>
      <AvatarImage {...args} />
    </Avatar>
  ),
};
