import type { Meta, StoryObj } from '../story-types';

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from './pagination';

/**
 * PaginationItem — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a page item
 * (`<li>`) only means something inside a PaginationContent. The contract
 * extractor still reads it, so the composer can bind and compose
 * PaginationItem.
 */
const meta = {
  title: 'Components/PaginationItem',
  component: PaginationItem,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  // An item holds exactly one page control.
  parameters: {
    puck: {
      slots: [
        {
          name: 'children',
          allow: [
            'PaginationLink',
            'PaginationPrevious',
            'PaginationNext',
            'PaginationEllipsis',
          ],
        },
      ],
    },
  },
} satisfies Meta<typeof PaginationItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink href='#'>1</PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
};
