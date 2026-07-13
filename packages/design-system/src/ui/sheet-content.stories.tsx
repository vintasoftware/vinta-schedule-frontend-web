import type { Meta, StoryObj } from '../story-types';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from './sheet';
import { Button } from './button';

/**
 * SheetContent — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: sheet content only means something inside a Sheet.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose SheetContent.
 */
const meta = {
  title: 'Components/SheetContent',
  component: SheetContent,
  tags: ['!dev'],
  argTypes: {
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
      description: 'Edge of the viewport the sheet slides in from',
    },
  },
  args: { side: 'right' },
  // Holds SheetHeader/SheetFooter plus arbitrary body content.
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof SheetContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Sheet defaultOpen>
      <SheetContent side='right'>
        <SheetHeader>
          <SheetTitle>Appointment details</SheetTitle>
          <SheetDescription>Dr. Lopez · Mon 9:00 AM</SheetDescription>
        </SheetHeader>
        <div className='text-muted-foreground px-4 py-2 text-sm'>
          Edit the visit, add notes, or reassign the provider.
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button>Done</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};
