import type { Meta, StoryObj } from '../story-types';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './breadcrumb';

const meta = {
  title: 'Components/Breadcrumb',
  component: Breadcrumb,
  tags: ['autodocs'],
  // The Breadcrumb root had no scalar prop of its own (its declared
  // `separator?: ReactNode` was never rendered — it leaked onto the <nav>). It
  // is now a real, rendered `separator` variant shared with every childless
  // BreadcrumbSeparator through context. `children` (the trail) is a slot.
  argTypes: {
    separator: {
      control: 'inline-radio',
      options: ['chevron', 'slash', 'dot'],
      description: 'Glyph rendered between crumbs',
    },
  },
  args: { separator: 'chevron' },
  // A breadcrumb holds exactly one trail list, nothing else.
  parameters: {
    puck: { slots: [{ name: 'children', allow: ['BreadcrumbList'] }] },
  },
} satisfies Meta<typeof Breadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Breadcrumb {...args}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href='#'>Calendars</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href='#'>Cardiology</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Dr. Lopez</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
};

export const SlashSeparator: Story = {
  args: { separator: 'slash' },
  render: (args) => (
    <Breadcrumb {...args}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href='#'>Calendars</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Cardiology</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
};
