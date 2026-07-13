import type { Meta, StoryObj } from '../story-types';

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './dialog';
import { Button } from './button';

/**
 * DialogTitle — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a dialog title only means something inside a DialogHeader.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose DialogTitle.
 * It's a leaf — `children` is plain editable text, not a slot.
 */
const meta = {
  title: 'Components/DialogTitle',
  component: DialogTitle,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Heading copy' },
  },
  args: { children: 'Create a booking' },
} satisfies Meta<typeof DialogTitle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button>New booking</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Create a booking</DialogTitle>
      </DialogContent>
    </Dialog>
  ),
};
