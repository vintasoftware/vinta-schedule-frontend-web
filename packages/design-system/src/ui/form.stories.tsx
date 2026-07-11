import type { Meta, StoryObj } from '../story-types';
import { useForm } from 'react-hook-form';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './form';
import { Input } from './input';
import { Button } from './button';

const meta = {
  title: 'Components/Form',
  // `Form` is react-hook-form's `FormProvider`: every one of its props is a
  // `useForm()` return value (control, register, formState, handleSubmit, …)
  // plus `children`. It has NO designer-editable scalar prop and cannot be
  // driven by Puck controls, so the single argTypes key below is declared with
  // a disabled control — it satisfies the emptiness check without fabricating a
  // prop that doesn't exist. `component` is intentionally omitted: FormProvider's
  // function name is `FormProvider`, which would not match the title leaf (§7).
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
