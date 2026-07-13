import type { Meta, StoryObj } from '../story-types';

import { AlertDialog, AlertDialogTrigger } from './alert-dialog';
import { Button } from './button';

/**
 * AlertDialogTrigger — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an alert dialog trigger only means something inside an AlertDialog.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose AlertDialogTrigger.
 * `children` is unrestricted — usually a Button, but anything can trigger it.
 */
const meta = {
  title: 'Components/AlertDialogTrigger',
  component: AlertDialogTrigger,
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
} satisfies Meta<typeof AlertDialogTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant='destructive'>Cancel appointment</Button>
      </AlertDialogTrigger>
    </AlertDialog>
  ),
};
