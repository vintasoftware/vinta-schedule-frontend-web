import type { Meta, StoryObj } from '../story-types';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Button } from './button';

/**
 * DialogHeader — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a dialog header only means something inside DialogContent.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose DialogHeader.
 * Its slot is restricted to DialogTitle/DialogDescription — that's the only
 * legal content of a header.
 */
const meta = {
  title: 'Components/DialogHeader',
  component: DialogHeader,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: {
    puck: {
      slots: [
        { name: 'children', allow: ['DialogTitle', 'DialogDescription'] },
      ],
    },
  },
} satisfies Meta<typeof DialogHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button>New booking</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a booking</DialogTitle>
          <DialogDescription>
            Add a one-off appointment to your schedule.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
};
