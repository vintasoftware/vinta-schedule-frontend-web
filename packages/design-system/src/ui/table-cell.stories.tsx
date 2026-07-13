import type { Meta, StoryObj } from '../story-types';

import { Table, TableBody, TableRow, TableCell } from './table';

/**
 * TableCell — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a data cell
 * (`<td>`) only means something inside a TableRow inside a TableBody/
 * TableFooter. Unlike TableHead, a cell may legally hold arbitrary content
 * (badges, buttons, formatted values), so `children` is an unrestricted slot.
 */
const meta = {
  title: 'Components/TableCell',
  component: TableCell,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof TableCell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table>
      <TableBody>
        <TableRow>
          <TableCell>$250.00</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
