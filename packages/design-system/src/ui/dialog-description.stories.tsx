import type { Meta, StoryObj } from '../story-types';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTrigger,
} from './dialog';
import { Button } from './button';

/**
 * DialogDescription — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a dialog description only means something inside a DialogHeader.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose DialogDescription.
 * It's a leaf — `children` is plain editable text, not a slot.
 */
const meta = {
  title: 'Components/DialogDescription',
  component: DialogDescription,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Supporting copy' },
  },
  args: { children: 'Add a one-off appointment to your schedule.' },
} satisfies Meta<typeof DialogDescription>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button>New booking</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogDescription>
          Add a one-off appointment to your schedule.
        </DialogDescription>
      </DialogContent>
    </Dialog>
  ),
};
