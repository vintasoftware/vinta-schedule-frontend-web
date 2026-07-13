import type { Meta, StoryObj } from '../story-types';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
} from './breadcrumb';

/**
 * BreadcrumbItem — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a crumb (`<li>`)
 * only means something inside a BreadcrumbList. The contract extractor still
 * reads it, so the composer can bind and compose BreadcrumbItem.
 */
const meta = {
  title: 'Components/BreadcrumbItem',
  component: BreadcrumbItem,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  // An item holds exactly one of: a link, the current page, or an ellipsis.
  parameters: {
    puck: {
      slots: [
        {
          name: 'children',
          allow: ['BreadcrumbLink', 'BreadcrumbPage', 'BreadcrumbEllipsis'],
        },
      ],
    },
  },
} satisfies Meta<typeof BreadcrumbItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href='#'>Calendars</BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
};
