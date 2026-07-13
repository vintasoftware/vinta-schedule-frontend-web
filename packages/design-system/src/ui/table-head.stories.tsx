import type { Meta, StoryObj } from '../story-types';

import { Table, TableHeader, TableRow, TableHead } from './table';

/**
 * TableHead — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a header cell
 * (`<th>`) only means something inside a TableRow inside a TableHeader. It is
 * a text leaf (a column label), so `children` is a plain text argType and
 * there is no slot.
 */
const meta = {
  title: 'Components/TableHead',
  component: TableHead,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Column label' },
  },
  args: { children: 'Invoice' },
} satisfies Meta<typeof TableHead>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead {...args} />
        </TableRow>
      </TableHeader>
    </Table>
  ),
};
