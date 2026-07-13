import type { Meta, StoryObj } from '../story-types';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTrigger,
} from './alert-dialog';
import { Button } from './button';

/**
 * AlertDialogDescription — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an alert dialog description only means something inside an AlertDialogHeader.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose AlertDialogDescription.
 * It's a leaf — `children` is plain editable text, not a slot.
 */
const meta = {
  title: 'Components/AlertDialogDescription',
  component: AlertDialogDescription,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Supporting copy' },
  },
  args: { children: 'The patient will be notified. This can’t be undone.' },
} satisfies Meta<typeof AlertDialogDescription>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogTrigger asChild>
        <Button variant='destructive'>Cancel appointment</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogDescription>
          The patient will be notified. This can’t be undone.
        </AlertDialogDescription>
      </AlertDialogContent>
    </AlertDialog>
  ),
};
