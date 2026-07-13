import type { Meta, StoryObj } from '../story-types';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTrigger,
} from './alert-dialog';
import { Button } from './button';

/**
 * AlertDialogCancel — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an alert dialog cancel only means something inside an AlertDialogFooter.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose AlertDialogCancel.
 * It's a leaf — `children` is plain editable text, not a slot.
 */
const meta = {
  title: 'Components/AlertDialogCancel',
  component: AlertDialogCancel,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Button label' },
  },
  args: { children: 'Keep it' },
} satisfies Meta<typeof AlertDialogCancel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogTrigger asChild>
        <Button variant='destructive'>Cancel appointment</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};
