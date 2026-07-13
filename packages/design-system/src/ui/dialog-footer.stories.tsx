import type { Meta, StoryObj } from '../story-types';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from './dialog';
import { Button } from './button';

/**
 * DialogFooter — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a dialog footer only means something inside DialogContent.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose DialogFooter.
 * `children` is unrestricted — action buttons.
 */
const meta = {
  title: 'Components/DialogFooter',
  component: DialogFooter,
  tags: ['!dev'],
  argTypes: {
    showCloseButton: {
      control: 'boolean',
      description: 'Append a built-in "Close" button after the children',
    },
  },
  args: { showCloseButton: false },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof DialogFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button>New booking</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant='outline'>Cancel</Button>
          </DialogClose>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
