import type { Meta, StoryObj } from '../story-types';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTrigger,
} from './alert-dialog';
import { Button } from './button';

/**
 * AlertDialogFooter — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an alert dialog footer only means something inside AlertDialogContent.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose AlertDialogFooter.
 * Its slot is restricted to AlertDialogCancel/AlertDialogAction — the only
 * legal actions in an alert dialog footer.
 */
const meta = {
  title: 'Components/AlertDialogFooter',
  component: AlertDialogFooter,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: {
    puck: {
      slots: [
        { name: 'children', allow: ['AlertDialogCancel', 'AlertDialogAction'] },
      ],
    },
  },
} satisfies Meta<typeof AlertDialogFooter>;

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
          <AlertDialogAction>Cancel appointment</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};
