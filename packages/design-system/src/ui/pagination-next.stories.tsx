import type { Meta, StoryObj } from '../story-types';

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
} from './pagination';

/**
 * PaginationNext — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: the "next page"
 * control only means something inside a PaginationItem inside a
 * PaginationContent. It renders a fixed "Next" label + icon, so its only
 * real prop is the link target — no slot.
 */
const meta = {
  title: 'Components/PaginationNext',
  component: PaginationNext,
  tags: ['!dev'],
  argTypes: {
    href: { control: 'text', description: 'Link target' },
  },
  args: { href: '#' },
} satisfies Meta<typeof PaginationNext>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationNext {...args} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
};
