import type { Meta, StoryObj } from '../story-types';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTrigger,
} from './alert-dialog';
import { Button } from './button';

/**
 * AlertDialogAction — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an alert dialog action only means something inside an AlertDialogFooter.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose AlertDialogAction.
 * It's a leaf — `children` is plain editable text, not a slot. It accepts the
 * same `variant`/`size` styling as Button (it's rendered with buttonVariants).
 */
const meta = {
  title: 'Components/AlertDialogAction',
  component: AlertDialogAction,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Button label' },
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'destructive',
        'outline',
        'ghost',
        'link',
      ],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'default', 'lg', 'xl', 'icon'],
    },
  },
  args: { children: 'Cancel appointment' },
} satisfies Meta<typeof AlertDialogAction>;

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
          <AlertDialogAction>Cancel appointment</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};
