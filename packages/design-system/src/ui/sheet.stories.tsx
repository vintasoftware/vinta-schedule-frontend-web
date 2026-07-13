import type { Meta, StoryObj } from '../story-types';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet';
import { Button } from './button';

const meta = {
  title: 'Components/Sheet',
  component: Sheet,
  tags: ['autodocs'],
  // Radix DialogProps: `open`/`defaultOpen`/`modal`/`onOpenChange`. `side` is a
  // SheetContent prop, not a root prop, so it is not curated here. `children`
  // (trigger + content) is the composed slot (§4).
  argTypes: {
    defaultOpen: {
      control: 'boolean',
      description: 'Open the sheet on mount (uncontrolled)',
    },
    modal: {
      control: 'boolean',
      description: 'Trap focus and block outside interaction',
    },
  },
  args: { defaultOpen: false, modal: true },
  // A sheet's children are its trigger and its overlay content — nothing else.
  parameters: {
    puck: {
      slots: [{ name: 'children', allow: ['SheetTrigger', 'SheetContent'] }],
    },
  },
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger asChild>
        <Button variant='outline'>Open details</Button>
      </SheetTrigger>
      <SheetContent>
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
