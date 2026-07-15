import type { Meta, StoryObj } from '@storybook/react-vite';

import { SchedulingChip } from './scheduling-chip';

const meta = {
  title: 'Components/SchedulingChip',
  component: SchedulingChip,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['booked', 'available', 'tentative', 'conflict'],
    },
    title: { control: 'text', description: 'Primary chip label' },
    meta: { control: 'text', description: 'Secondary line under the title' },
  },
  args: {
    status: 'booked',
    title: 'Prenatal intake',
    meta: 'Dr. Pires · Room 2',
  },
} satisfies Meta<typeof SchedulingChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <SchedulingChip className='w-56' {...args} />,
};

export const States: Story = {
  render: () => (
    <div className='flex w-56 flex-col gap-2'>
      <SchedulingChip
        status='booked'
        title='Prenatal intake'
        meta='Dr. Pires · Room 2'
      />
      <SchedulingChip
        status='available'
        title='Available'
        meta='Open for booking'
      />
      <SchedulingChip
        status='tentative'
        title='Hold — follow-up'
        meta='Pending confirmation'
      />
      <SchedulingChip
        status='conflict'
        title='Double-booked'
        meta='2 calendars overlap'
      />
    </div>
  ),
};

const HOURS = [
  {
    t: '9 AM',
    node: (
      <SchedulingChip
        status='booked'
        title='Prenatal intake'
        meta='Dr. Pires · Room 2'
      />
    ),
  },
  {
    t: '10 AM',
    node: (
      <SchedulingChip
        status='available'
        title='Available'
        meta='Open for booking'
      />
    ),
  },
  {
    t: '11 AM',
    node: (
      <SchedulingChip
        status='tentative'
        title='Hold — follow-up'
        meta='Pending confirmation'
      />
    ),
  },
  {
    t: '12 PM',
    node: (
      <SchedulingChip
        status='conflict'
        title='Double-booked'
        meta='2 calendars overlap'
      />
    ),
  },
];

export const InCalendar: Story = {
  render: () => (
    <div className='grid w-80 grid-cols-[44px_1fr] gap-x-2.5'>
      {HOURS.map(({ t, node }) => (
        <div key={t} className='contents'>
          <div className='text-muted-foreground pt-1 text-right font-mono text-[11px]'>
            {t}
          </div>
          <div className='border-border border-t py-1'>{node}</div>
        </div>
      ))}
    </div>
  ),
};
