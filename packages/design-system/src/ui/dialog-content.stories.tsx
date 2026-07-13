import type { Meta, StoryObj } from '../story-types';

import { Dialog, DialogContent, DialogTrigger } from './dialog';
import { Button } from './button';

/**
 * DialogContent — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: dialog content only means something inside a Dialog.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose DialogContent.
 * `children` is unrestricted — it holds DialogHeader/DialogFooter AND
 * arbitrary body content. The story renders the Dialog open (`defaultOpen`)
 * so the content is actually visible.
 */
const meta = {
  title: 'Components/DialogContent',
  component: DialogContent,
  tags: ['!dev'],
  argTypes: {
    showCloseButton: {
      control: 'boolean',
      description: 'Show the built-in top-right close (X) button',
    },
  },
  args: { showCloseButton: true },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof DialogContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button>New booking</Button>
      </DialogTrigger>
      <DialogContent>Booking details go here.</DialogContent>
    </Dialog>
  ),
};
