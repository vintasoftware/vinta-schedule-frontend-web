import type { Meta, StoryObj } from '../story-types';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
} from './breadcrumb';

/**
 * BreadcrumbLink — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a crumb link only
 * means something inside a BreadcrumbItem inside a BreadcrumbList. It is a
 * text leaf (a crumb label), so `children` is a plain text argType and there
 * is no slot.
 */
const meta = {
  title: 'Components/BreadcrumbLink',
  component: BreadcrumbLink,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Crumb label' },
    href: { control: 'text', description: 'Link target' },
  },
  args: { children: 'Calendars', href: '#' },
} satisfies Meta<typeof BreadcrumbLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink {...args} />
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
};
