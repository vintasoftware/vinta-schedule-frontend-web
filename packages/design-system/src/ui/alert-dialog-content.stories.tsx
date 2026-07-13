import type { Meta, StoryObj } from '../story-types';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTrigger,
} from './alert-dialog';
import { Button } from './button';

/**
 * AlertDialogContent — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: alert dialog content only means something inside an AlertDialog.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose AlertDialogContent.
 * `children` is unrestricted. The story renders the AlertDialog open
 * (`defaultOpen`) so the content is actually visible.
 */
const meta = {
  title: 'Components/AlertDialogContent',
  component: AlertDialogContent,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof AlertDialogContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogTrigger asChild>
        <Button variant='destructive'>Cancel appointment</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>Cancel this appointment?</AlertDialogContent>
    </AlertDialog>
  ),
};
