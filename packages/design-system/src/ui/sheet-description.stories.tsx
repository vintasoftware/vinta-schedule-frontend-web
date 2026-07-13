import type { Meta, StoryObj } from '../story-types';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './sheet';

/**
 * SheetDescription — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a sheet description only means something inside SheetHeader.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose SheetDescription.
 */
const meta = {
  title: 'Components/SheetDescription',
  component: SheetDescription,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Copy' },
  },
  args: { children: 'Dr. Lopez · Mon 9:00 AM' },
} satisfies Meta<typeof SheetDescription>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Sheet defaultOpen>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Appointment details</SheetTitle>
          <SheetDescription>Dr. Lopez · Mon 9:00 AM</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
