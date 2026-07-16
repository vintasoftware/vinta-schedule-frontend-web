import type { Meta, StoryObj } from '@storybook/react-vite';

import { AppShell } from './app-shell';
import { Sidebar, SidebarGroup, SidebarItem } from './sidebar';
import { AppTopbar } from './app-topbar';
import { Heading } from './heading';
import { Text } from './text';
import { Stack } from './stack';

const meta = {
  title: 'Layout/AppShell',
  component: AppShell,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    width: {
      control: 'inline-radio',
      options: ['contained', 'full'],
      description: 'Cap the page body to the contained width, or run full',
    },
  },
  args: { width: 'contained' },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <AppShell
      {...args}
      sidebar={
        <Sidebar brand={<Text weight='bold'>Vinta Schedule</Text>}>
          <SidebarGroup>
            <SidebarItem label='Calendar' iconName='calendar' active />
            <SidebarItem label='Bookings' iconName='calendar-days' badge={8} />
          </SidebarGroup>
        </Sidebar>
      }
      topbar={<AppTopbar title='Calendar' subtitle='This week · 3 bookings' />}
    >
      <Stack gap={4}>
        <Heading level={2}>Up next</Heading>
        <Text color='muted-foreground'>
          The whole shell — rail, topbar and body — is design-system components.
        </Text>
      </Stack>
    </AppShell>
  ),
};
