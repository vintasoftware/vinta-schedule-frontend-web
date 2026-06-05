import type { StoryObj } from '@storybook/react';
import { GroupsTable } from './groups-table';

const meta = {
  title: 'Components / Calendar Groups / GroupsTable',
  component: GroupsTable,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * GroupsTable story.
 *
 * Note: This is a client component that requires DataTableQueryBoundary context.
 * The story is a placeholder; full integration testing happens in the page-level test.
 */
export const Default: Story = {};
