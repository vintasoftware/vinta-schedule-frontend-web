import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CalendarPlus, Download } from 'lucide-react';

import { PageHeader } from './page-header';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const meta = {
  title: 'Composition/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
  args: {
    title: 'Bookings',
    description: 'Manage upcoming and past appointments.',
  },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <PageHeader className='w-[640px]' {...args} />,
};

export const WithActions: Story = {
  render: (args) => (
    <PageHeader
      className='w-[640px]'
      {...args}
      actions={
        <>
          <Button variant='outline' size='sm'>
            <Download />
            Export
          </Button>
          <Button size='sm'>
            <CalendarPlus />
            New booking
          </Button>
        </>
      }
    />
  ),
};

export const WithBreadcrumb: Story = {
  render: (args) => (
    <PageHeader
      className='w-[640px]'
      {...args}
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href='#'>Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Bookings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    />
  ),
};
