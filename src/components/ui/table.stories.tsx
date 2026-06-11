import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  TableFooter,
} from './table';

const meta = {
  title: 'UI/Table',
  component: Table,
  tags: ['autodocs'],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className='p-6'>
      <Table>
        <TableCaption>A list of recent invoices.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className='text-right'>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            {
              id: 'INV001',
              status: 'Paid',
              method: 'Credit Card',
              amount: '$250.00',
            },
            {
              id: 'INV002',
              status: 'Pending',
              method: 'PayPal',
              amount: '$150.00',
            },
            {
              id: 'INV003',
              status: 'Unpaid',
              method: 'Bank Transfer',
              amount: '$350.00',
            },
          ].map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className='font-medium'>{invoice.id}</TableCell>
              <TableCell>{invoice.status}</TableCell>
              <TableCell>{invoice.method}</TableCell>
              <TableCell className='text-right'>{invoice.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell className='text-right'>$750.00</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  ),
};
