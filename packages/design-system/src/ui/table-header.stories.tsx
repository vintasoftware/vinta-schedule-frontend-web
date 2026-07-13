import type { Meta, StoryObj } from '../story-types';

import { Table, TableHeader, TableRow, TableHead } from './table';

/**
 * TableHeader — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a table header
 * (`<thead>`) only means something inside a `<table>`. The contract extractor
 * still reads it, so the composer can bind and compose TableHeader.
 */
const meta = {
  title: 'Components/TableHeader',
  component: TableHeader,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  // A header holds header rows, nothing else.
  parameters: {
    puck: { slots: [{ name: 'children', allow: ['TableRow'] }] },
  },
} satisfies Meta<typeof TableHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
    </Table>
  ),
};
