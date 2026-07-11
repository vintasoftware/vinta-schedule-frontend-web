import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';
import { Button } from './button';
import { Badge } from './badge';

const meta = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className='w-80'>
      <CardHeader>
        <CardTitle>Annual checkup</CardTitle>
        <CardDescription>Dr. Lopez · Cardiology</CardDescription>
      </CardHeader>
      <CardContent className='space-y-2 text-sm'>
        <div className='flex justify-between'>
          <span className='text-muted-foreground'>When</span>
          <span className='font-mono'>Mon, 9:00–9:30 AM</span>
        </div>
        <div className='flex justify-between'>
          <span className='text-muted-foreground'>Status</span>
          <Badge className='bg-success border-transparent text-white'>
            Confirmed
          </Badge>
        </div>
      </CardContent>
      <CardFooter className='gap-2'>
        <Button className='flex-1'>Reschedule</Button>
        <Button variant='outline' className='flex-1'>
          Cancel
        </Button>
      </CardFooter>
    </Card>
  ),
};
