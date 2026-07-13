import type { Meta, StoryObj } from '../story-types';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from './breadcrumb';

/**
 * BreadcrumbSeparator — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a separator only
 * means something between crumbs inside a BreadcrumbList. Childless, it
 * renders the glyph chosen by the ancestor Breadcrumb's `separator` prop, so
 * it has no interesting scalar prop of its own and no slot.
 */
const meta = {
  title: 'Components/BreadcrumbSeparator',
  component: BreadcrumbSeparator,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
} satisfies Meta<typeof BreadcrumbSeparator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href='#'>Calendars</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href='#'>Cardiology</BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
};
