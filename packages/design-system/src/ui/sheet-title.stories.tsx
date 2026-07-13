import type { Meta, StoryObj } from '../story-types';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from './sheet';

/**
 * SheetTitle — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a sheet title only means something inside SheetHeader.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose SheetTitle.
 */
const meta = {
  title: 'Components/SheetTitle',
  component: SheetTitle,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Copy' },
  },
  args: { children: 'Appointment details' },
} satisfies Meta<typeof SheetTitle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Sheet defaultOpen>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Appointment details</SheetTitle>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
