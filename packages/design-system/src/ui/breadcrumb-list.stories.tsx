import type { Meta, StoryObj } from '../story-types';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from './breadcrumb';

/**
 * BreadcrumbList — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an `<ol>` trail
 * only means something inside Breadcrumb (it reads the separator variant from
 * context). The contract extractor still reads it, so the composer can bind
 * and compose BreadcrumbList.
 */
const meta = {
  title: 'Components/BreadcrumbList',
  component: BreadcrumbList,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  // The trail holds crumbs and separators, nothing else.
  parameters: {
    puck: {
      slots: [
        { name: 'children', allow: ['BreadcrumbItem', 'BreadcrumbSeparator'] },
      ],
    },
  },
} satisfies Meta<typeof BreadcrumbList>;

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
