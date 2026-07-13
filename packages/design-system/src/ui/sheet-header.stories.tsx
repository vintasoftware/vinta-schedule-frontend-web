import type { Meta, StoryObj } from '../story-types';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './sheet';

/**
 * SheetHeader — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a sheet header only means something inside SheetContent.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose SheetHeader.
 */
const meta = {
  title: 'Components/SheetHeader',
  component: SheetHeader,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  // A header only makes sense with a title and optional description.
  parameters: {
    puck: {
      slots: [{ name: 'children', allow: ['SheetTitle', 'SheetDescription'] }],
    },
  },
} satisfies Meta<typeof SheetHeader>;

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
