import type { Meta, StoryObj } from '../story-types';

import { Dialog, DialogTrigger } from './dialog';
import { Button } from './button';

/**
 * DialogTrigger — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a dialog trigger only means something inside a Dialog.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose DialogTrigger.
 * `children` is unrestricted — usually a Button, but anything can trigger a dialog.
 */
const meta = {
  title: 'Components/DialogTrigger',
  component: DialogTrigger,
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
} satisfies Meta<typeof DialogTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>New booking</Button>
      </DialogTrigger>
    </Dialog>
  ),
};
