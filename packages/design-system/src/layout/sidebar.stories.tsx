import type { Meta, StoryObj } from '../story-types';

import { Sidebar, SidebarGroup, SidebarItem } from './sidebar';
import { Text } from './text';

const meta = {
  title: 'Layout/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    // brand / footer / children are all composed content.
    puck: { slots: ['brand', 'children', 'footer'] },
  },
  argTypes: {
    width: {
      control: 'select',
      options: [224, 256, 288, 320],
      description: 'Rail width in px',
    },
  },
  args: { width: 256 },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Sidebar
      {...args}
      brand={<Text weight='bold'>Vinta Schedule</Text>}
      footer={
        <Text size='sm' color='muted-foreground'>
          Renata Pires
        </Text>
      }
    >
      <SidebarGroup>
        <SidebarItem label='Calendar' iconName='calendar' active />
        <SidebarItem label='Bookings' iconName='calendar-days' badge={8} />
        <SidebarItem label='Groups' iconName='users' />
      </SidebarGroup>
      <SidebarGroup label='Configure'>
        <SidebarItem label='Settings' iconName='settings' />
      </SidebarGroup>
    </Sidebar>
  ),
};
