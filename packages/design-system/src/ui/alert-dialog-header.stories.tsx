import type { Meta, StoryObj } from '../story-types';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog';
import { Button } from './button';

/**
 * AlertDialogHeader — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an alert dialog header only means something inside AlertDialogContent.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose AlertDialogHeader.
 * Its slot is restricted to AlertDialogTitle/AlertDialogDescription — that's
 * the only legal content of a header.
 */
const meta = {
  title: 'Components/AlertDialogHeader',
  component: AlertDialogHeader,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: {
    puck: {
      slots: [
        {
          name: 'children',
          allow: ['AlertDialogTitle', 'AlertDialogDescription'],
        },
      ],
    },
  },
} satisfies Meta<typeof AlertDialogHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AlertDialog defaultOpen>
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
      </AlertDialogContent>
    </AlertDialog>
  ),
};
