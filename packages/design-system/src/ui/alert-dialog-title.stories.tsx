import type { Meta, StoryObj } from '../story-types';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog';
import { Button } from './button';

/**
 * AlertDialogTitle — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an alert dialog title only means something inside an AlertDialogHeader.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose AlertDialogTitle.
 * It's a leaf — `children` is plain editable text, not a slot.
 */
const meta = {
  title: 'Components/AlertDialogTitle',
  component: AlertDialogTitle,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Heading copy' },
  },
  args: { children: 'Cancel this appointment?' },
} satisfies Meta<typeof AlertDialogTitle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogTrigger asChild>
        <Button variant='destructive'>Cancel appointment</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
      </AlertDialogContent>
    </AlertDialog>
  ),
};
