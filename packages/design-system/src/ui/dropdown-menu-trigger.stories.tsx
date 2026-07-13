import type { Meta, StoryObj } from '../story-types';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Button } from './button';

/**
 * DropdownMenuTrigger — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a trigger only means
 * something inside DropdownMenu. The contract extractor still reads it, so the
 * composer can bind and compose DropdownMenuTrigger.
 */
const meta = {
  title: 'Components/DropdownMenuTrigger',
  component: DropdownMenuTrigger,
  tags: ['!dev'],
  // `children` holds whatever triggers the menu (usually a Button) — any
  // component is legal there, so it stays an unrestricted slot.
  argTypes: {
    asChild: {
      control: 'boolean',
      description:
        'Merge props onto the immediate child instead of rendering a button',
    },
  },
  args: { asChild: true },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof DropdownMenuTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger {...args}>
        <Button variant='outline'>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start'>
        <DropdownMenuItem>Reschedule</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
