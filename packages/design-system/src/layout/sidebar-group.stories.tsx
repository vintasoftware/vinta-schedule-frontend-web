import type { Meta, StoryObj } from '../story-types';

import { SidebarGroup, SidebarItem } from './sidebar';

/**
 * SidebarGroup — BINDING-ONLY story (`tags: ['!dev']`). A nav section is
 * meaningless outside a Sidebar; it is documented in the Sidebar story.
 */
const meta = {
  title: 'Layout/SidebarGroup',
  component: SidebarGroup,
  tags: ['!dev'],
  argTypes: {
    label: { control: 'text', description: 'Optional section heading' },
  },
  args: { label: 'Configure' },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof SidebarGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <SidebarGroup {...args}>
      <SidebarItem label='Settings' iconName='settings' />
    </SidebarGroup>
  ),
};
