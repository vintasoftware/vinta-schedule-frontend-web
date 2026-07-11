import type { Meta, StoryObj } from '@storybook/react-vite';

import { Progress } from './progress';

const meta = {
  title: 'Components/Progress',
  component: Progress,
  tags: ['autodocs'],
  args: { value: 60 },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <Progress className='w-80' {...args} />,
};

export const Steps: Story = {
  render: () => (
    <div className='flex w-80 flex-col gap-4'>
      <Progress value={25} />
      <Progress value={50} />
      <Progress value={100} />
    </div>
  ),
};
