import type { Meta, StoryObj } from '../story-types';

import { Table, TableBody, TableRow, TableCell } from './table';

/**
 * TableBody — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a table body
 * (`<tbody>`) only means something inside a `<table>`. The contract extractor
 * still reads it, so the composer can bind and compose TableBody.
 */
const meta = {
  title: 'Components/TableBody',
  component: TableBody,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  // A body holds data rows, nothing else.
  parameters: {
    puck: { slots: [{ name: 'children', allow: ['TableRow'] }] },
  },
} satisfies Meta<typeof TableBody>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table>
      <TableBody>
        <TableRow>
          <TableCell>INV001</TableCell>
          <TableCell>Paid</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
