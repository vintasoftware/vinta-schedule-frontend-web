'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from 'vinta-schedule-design-system/ui/dialog';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from 'vinta-schedule-design-system/ui/form';
import { useCreateCalendar } from '@/hooks/calendars/use-create-calendar';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const createCalendarSchema = z.object({
  // Calendar name is required and must be non-empty after trimming.
  name: z.string().trim().min(1, { message: 'Calendar name is required' }),
  description: z.string().trim().optional(),
});

type CreateCalendarSchema = z.infer<typeof createCalendarSchema>;

// ---------------------------------------------------------------------------
// CreateCalendarDialog
//
// Dialog that lets a member create a personal calendar with a name and
// optional description.
//
// Submit-button debounce:
//   The submit button is disabled while the mutation is pending
//   (isPending flag), preventing double-submit.
// ---------------------------------------------------------------------------

interface CreateCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCalendarDialog({
  open,
  onOpenChange,
}: CreateCalendarDialogProps) {
  const { createCalendar, createCalendarMutation } = useCreateCalendar();

  const form = useForm<CreateCalendarSchema>({
    resolver: zodResolver(createCalendarSchema),
    defaultValues: { name: '', description: '' },
  });

  // Reset dialog state when it opens/closes.
  React.useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const isPending = createCalendarMutation.isPending;

  // -------------------------------------------------------------------------
  // onSubmit — create the calendar
  // -------------------------------------------------------------------------

  const onSubmit = async (values: CreateCalendarSchema) => {
    try {
      await createCalendar({
        name: values.name,
        ...(values.description && { description: values.description }),
      });
      toast.success('Calendar created', {
        description: `Your calendar "${values.name}" was created successfully.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to create calendar', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a calendar</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col gap-4'
            noValidate
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Calendar name</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      placeholder='My calendar'
                      autoComplete='off'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      placeholder='A brief description'
                      autoComplete='off'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending ? 'Creating…' : 'Create calendar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
