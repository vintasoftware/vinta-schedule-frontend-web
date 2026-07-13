import type { Meta, StoryObj } from '../story-types';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from './breadcrumb';

/**
 * BreadcrumbPage — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: the current-page
 * crumb only means something inside a BreadcrumbItem inside a
 * BreadcrumbList. It is a text leaf, so `children` is a plain text argType
 * and there is no slot.
 */
const meta = {
  title: 'Components/BreadcrumbPage',
  component: BreadcrumbPage,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Current page label' },
  },
  args: { children: 'Dr. Lopez' },
} satisfies Meta<typeof BreadcrumbPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage {...args} />
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
};
