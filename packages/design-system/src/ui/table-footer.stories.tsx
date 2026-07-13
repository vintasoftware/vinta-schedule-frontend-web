import type { Meta, StoryObj } from '../story-types';

import { Table, TableFooter, TableRow, TableCell } from './table';

/**
 * TableFooter — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a table footer
 * (`<tfoot>`) only means something inside a `<table>`. The contract extractor
 * still reads it, so the composer can bind and compose TableFooter.
 */
const meta = {
  title: 'Components/TableFooter',
  component: TableFooter,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  // A footer holds summary rows, nothing else.
  parameters: {
    puck: { slots: [{ name: 'children', allow: ['TableRow'] }] },
  },
} satisfies Meta<typeof TableFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell className='text-right'>$750.00</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};
