import type { Meta, StoryObj } from '../story-types';

import { Table, TableBody, TableRow, TableCell } from './table';

/**
 * TableRow — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a table row
 * (`<tr>`) only means something inside a `<thead>`/`<tbody>`/`<tfoot>`. The
 * contract extractor still reads it, so the composer can bind and compose
 * TableRow. A row may hold either header cells (TableHead) or data cells
 * (TableCell) depending on which section it lives in.
 */
const meta = {
  title: 'Components/TableRow',
  component: TableRow,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: {
    puck: { slots: [{ name: 'children', allow: ['TableHead', 'TableCell'] }] },
  },
} satisfies Meta<typeof TableRow>;

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
