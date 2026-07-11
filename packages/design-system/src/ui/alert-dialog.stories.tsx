import type { Meta, StoryObj } from '../story-types';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog';
import { Button } from './button';

const meta = {
  title: 'Components/AlertDialog',
  component: AlertDialog,
  tags: ['autodocs'],
  // Radix AlertDialog.Root is `Omit<DialogProps, 'modal'>` — an alert dialog is
  // always modal — so `defaultOpen` is its only real scalar prop (`open` /
  // `onOpenChange` are controlled-mode only). `children` (trigger + content) is
  // composed content → a slot.
  argTypes: {
    defaultOpen: {
      control: 'boolean',
      description: 'Open on first render (uncontrolled)',
    },
  },
  args: { defaultOpen: false },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof AlertDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <AlertDialog {...args}>
      <AlertDialogTrigger asChild>
        <Button variant='destructive'>Cancel appointment</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
          <AlertDialogDescription>
            The patient will be notified. This can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction>Cancel appointment</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};
