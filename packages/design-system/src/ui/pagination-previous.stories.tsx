import type { Meta, StoryObj } from '../story-types';

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
} from './pagination';

/**
 * PaginationPrevious — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: the "previous
 * page" control only means something inside a PaginationItem inside a
 * PaginationContent. It renders a fixed icon + "Previous" label, so its only
 * real prop is the link target — no slot.
 */
const meta = {
  title: 'Components/PaginationPrevious',
  component: PaginationPrevious,
  tags: ['!dev'],
  argTypes: {
    href: { control: 'text', description: 'Link target' },
  },
  args: { href: '#' },
} satisfies Meta<typeof PaginationPrevious>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious {...args} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
};
