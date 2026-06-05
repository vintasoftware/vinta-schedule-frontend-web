import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue='upcoming' className='w-96'>
      <TabsList className='grid w-full grid-cols-3'>
        <TabsTrigger value='upcoming'>Upcoming</TabsTrigger>
        <TabsTrigger value='past'>Past</TabsTrigger>
        <TabsTrigger value='canceled'>Canceled</TabsTrigger>
      </TabsList>
      <TabsContent
        value='upcoming'
        className='text-muted-foreground pt-3 text-sm'
      >
        3 upcoming appointments this week.
      </TabsContent>
      <TabsContent value='past' className='text-muted-foreground pt-3 text-sm'>
        12 appointments in the last 30 days.
      </TabsContent>
      <TabsContent
        value='canceled'
        className='text-muted-foreground pt-3 text-sm'
      >
        No cancellations. Nice.
      </TabsContent>
    </Tabs>
  ),
};
