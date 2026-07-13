import type { Meta, StoryObj } from '../story-types';

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationEllipsis,
} from './pagination';

/**
 * PaginationEllipsis — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: the collapsed-
 * range marker only means something inside a PaginationItem inside a
 * PaginationContent. It renders a fixed "More" glyph and has no interesting
 * scalar prop of its own, so it has no slot.
 */
const meta = {
  title: 'Components/PaginationEllipsis',
  component: PaginationEllipsis,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
} satisfies Meta<typeof PaginationEllipsis>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
};
