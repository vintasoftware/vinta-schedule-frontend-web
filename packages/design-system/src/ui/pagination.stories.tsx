import type { Meta, StoryObj } from '../story-types';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './pagination';

const meta = {
  title: 'Components/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  // The Pagination root is a bare <nav> and had no scalar prop of its own, so a
  // real `align` prop was added (pagination.tsx) rather than faking one — it
  // drives the nav's justify-* and was previously hard-coded to center.
  // `children` (the page list) is composed content → a slot.
  argTypes: {
    align: {
      control: 'inline-radio',
      options: ['start', 'center', 'end'],
      description: 'Horizontal alignment of the page list',
    },
  },
  args: { align: 'center' },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Pagination {...args}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href='#' />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href='#'>1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href='#' isActive>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href='#'>3</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href='#' />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
};
