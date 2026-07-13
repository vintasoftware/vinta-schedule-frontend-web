import type { Meta, StoryObj } from '../story-types';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbEllipsis,
} from './breadcrumb';

/**
 * BreadcrumbEllipsis — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: the collapsed-
 * trail marker only means something inside a BreadcrumbItem inside a
 * BreadcrumbList. It renders a fixed "More" glyph and has no interesting
 * scalar prop of its own, so it has no slot.
 */
const meta = {
  title: 'Components/BreadcrumbEllipsis',
  component: BreadcrumbEllipsis,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
} satisfies Meta<typeof BreadcrumbEllipsis>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbEllipsis />
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
};
