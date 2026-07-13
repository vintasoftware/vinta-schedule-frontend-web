import type { Meta, StoryObj } from '../story-types';

import { Dialog, DialogClose, DialogContent, DialogTrigger } from './dialog';
import { Button } from './button';

/**
 * DialogClose — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a dialog close only means something inside DialogContent.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose DialogClose.
 * `children` is unrestricted — it wraps a button (or anything clickable).
 */
const meta = {
  title: 'Components/DialogClose',
  component: DialogClose,
  tags: ['!dev'],
  argTypes: {
    asChild: {
      control: 'boolean',
      description:
        'Merge props onto the single child instead of rendering a button',
    },
  },
  args: { asChild: true },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof DialogClose>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button>New booking</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogClose asChild>
          <Button variant='outline'>Cancel</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  ),
};
