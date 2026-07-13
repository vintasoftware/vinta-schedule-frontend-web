import type { Meta, StoryObj } from '../story-types';

import { Table, TableCaption } from './table';

/**
 * TableCaption — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a `<caption>`
 * only means something inside a `<table>`. It is a text leaf, so `children`
 * is a plain text argType and there is no slot.
 */
const meta = {
  title: 'Components/TableCaption',
  component: TableCaption,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Caption text' },
  },
  args: { children: 'A list of recent invoices.' },
} satisfies Meta<typeof TableCaption>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Table>
      <TableCaption {...args} />
    </Table>
  ),
};
