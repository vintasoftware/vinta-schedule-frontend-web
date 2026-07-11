import type { Meta, StoryObj } from '../story-types';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  // Radix Tabs.Root scalars (`value` / `onValueChange` are controlled-mode
  // only). `children` (TabsList + TabsContent) is composed content → a slot.
  argTypes: {
    defaultValue: {
      control: 'text',
      description: 'Value of the tab selected on first render',
    },
    orientation: {
      control: 'inline-radio',
      options: ['horizontal', 'vertical'],
    },
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
    activationMode: {
      control: 'inline-radio',
      options: ['automatic', 'manual'],
      description: 'Select a tab on focus, or only on click/Enter',
    },
  },
  args: {
    defaultValue: 'upcoming',
    orientation: 'horizontal',
    activationMode: 'automatic',
  },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Tabs {...args} className='w-96'>
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
