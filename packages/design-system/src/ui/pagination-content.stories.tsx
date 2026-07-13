import type { Meta, StoryObj } from '../story-types';

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from './pagination';

/**
 * PaginationContent — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: the page list
 * (`<ul>`) only means something inside Pagination. The contract extractor
 * still reads it, so the composer can bind and compose PaginationContent.
 */
const meta = {
  title: 'Components/PaginationContent',
  component: PaginationContent,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  // The list holds page items, nothing else.
  parameters: {
    puck: { slots: [{ name: 'children', allow: ['PaginationItem'] }] },
  },
} satisfies Meta<typeof PaginationContent>;

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
