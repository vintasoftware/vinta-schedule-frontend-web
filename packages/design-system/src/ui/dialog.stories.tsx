import type { Meta, StoryObj } from '../story-types';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  // Radix Dialog.Root scalars (`open` / `onOpenChange` are controlled-mode only,
  // so they stay out). `children` (trigger + content) is composed → a slot.
  argTypes: {
    defaultOpen: {
      control: 'boolean',
      description: 'Open on first render (uncontrolled)',
    },
    modal: {
      control: 'boolean',
      description: 'Trap focus and block interaction outside the dialog',
    },
  },
  args: { defaultOpen: false, modal: true },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button>New booking</Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Create a booking</DialogTitle>
          <DialogDescription>
            Add a one-off appointment to your schedule.
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-3 py-2'>
          <Label htmlFor='title'>Title</Label>
          <Input id='title' placeholder='Follow-up visit' />
        </div>
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
