import type { Meta, StoryObj } from '../story-types';

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from './pagination';

/**
 * PaginationLink — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a page link only
 * means something inside a PaginationItem inside a PaginationContent. It is
 * a text leaf (a page number), so `children` is a plain text argType and
 * there is no slot.
 */
const meta = {
  title: 'Components/PaginationLink',
  component: PaginationLink,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Page number label' },
    href: { control: 'text', description: 'Link target' },
    isActive: {
      control: 'boolean',
      description: 'Marks this as the current page',
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'default', 'lg', 'xl', 'icon'],
      description: 'Button size applied to the link',
    },
  },
  args: { children: '1', href: '#', isActive: false, size: 'icon' },
} satisfies Meta<typeof PaginationLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink {...args} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
};
