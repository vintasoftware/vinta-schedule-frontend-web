import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootMessage,
} from './form';
import { Input } from './input';
import { Button } from './button';

const meta = {
  title: 'Components/Form',
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: { type: 'text', disable: true },
      description:
        'Fields rendered inside the react-hook-form context. Supplied in code, not editable.',
    },
  },
} satisfies Meta<typeof Form>;

export default meta;
// Form (FormProvider) has many required props, so type stories loosely (render-only).
type Story = StoryObj;

type Values = { email: string };

const BookingForm = () => {
  const form = useForm<Values>({ defaultValues: { email: '' } });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})} className='w-80 space-y-4'>
        <FormField
          control={form.control}
          name='email'
          rules={{ required: 'Email is required' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder='you@clinic.com' {...field} />
              </FormControl>
              <FormDescription>
                We’ll send the booking confirmation here.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit'>Confirm booking</Button>
      </form>
    </Form>
  );
};

export const Default: Story = { render: () => <BookingForm /> };

/**
 * A form-level error — the shape a server returns when a rejection belongs to
 * the submission as a whole rather than to any one input. `FormRootMessage`
 * renders whatever react-hook-form holds under `root`.
 */
const ServerRejectedForm = () => {
  const form = useForm<Values>({
    defaultValues: { email: 'taken@example.com' },
  });

  // Stand in for a rejected submission having set the root error.
  useEffect(() => {
    form.setError('root', { message: 'That email is already registered.' });
  }, [form]);

  return (
    <Form {...form}>
      <FormRootMessage />
      <form onSubmit={form.handleSubmit(() => {})} className='w-80 space-y-4'>
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder='you@example.com' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit'>Sign up</Button>
      </form>
    </Form>
  );
};

export const WithRootError: Story = {
  render: () => <ServerRejectedForm />,
};
