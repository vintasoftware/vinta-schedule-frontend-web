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
  DialogDescription,
  DialogFooter,
} from '@vinta-schedule/design-system/ui/dialog';
import { Button } from '@vinta-schedule/design-system/ui/button';
import { Input } from '@vinta-schedule/design-system/ui/input';
import { Switch } from '@vinta-schedule/design-system/ui/switch';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@vinta-schedule/design-system/ui/form';
import { HStack } from '@vinta-schedule/design-system/layout';
import { useCreateResourceCalendar } from '@/hooks/calendars/use-create-resource-calendar';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const createResourceCalendarSchema = z.object({
  // Resource name is required and must be non-empty after trimming.
  name: z.string().trim().min(1, { message: 'Resource name is required' }),
  description: z.string().trim().optional(),
  // Capacity is optional; when given it must be a positive integer.
  capacity: z
    .union([z.number().int().positive(), z.nan()])
    .optional()
    .transform((v) => (v === undefined || Number.isNaN(v) ? undefined : v)),
  manage_available_windows: z.boolean(),
});

type CreateResourceCalendarSchema = z.input<
  typeof createResourceCalendarSchema
>;

// ---------------------------------------------------------------------------
// CreateResourceCalendarDialog
//
// Admin-only dialog to create an internal (manual) resource calendar — a shared
// bookable resource (room, equipment, etc.). Collects a name, optional
// description, optional capacity (max attendees), and a "manage availability
// windows" toggle.
//
// Submit-button debounce: the submit button is disabled while the mutation is
// pending (isPending flag), preventing double-submit.
// ---------------------------------------------------------------------------

export interface CreateResourceCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful create so the parent can react (e.g. refetch). */
  onCreated?: () => void;
}

export function CreateResourceCalendarDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateResourceCalendarDialogProps) {
  const { createResourceCalendar, createResourceCalendarMutation } =
    useCreateResourceCalendar();

  const form = useForm<CreateResourceCalendarSchema>({
    resolver: zodResolver(createResourceCalendarSchema),
    defaultValues: {
      name: '',
      description: '',
      capacity: undefined,
      manage_available_windows: false,
    },
  });

  // Reset dialog state when it opens/closes.
  React.useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const isPending = createResourceCalendarMutation.isPending;

  // -------------------------------------------------------------------------
  // onSubmit — create the resource calendar
  // -------------------------------------------------------------------------

  const onSubmit = form.handleSubmit(async (values) => {
    // values is already parsed/transformed by the zod resolver, so `capacity`
    // is either a positive integer or undefined here.
    const parsed = values as z.output<typeof createResourceCalendarSchema>;
    try {
      await createResourceCalendar({
        name: parsed.name,
        ...(parsed.description ? { description: parsed.description } : {}),
        ...(parsed.capacity !== undefined ? { capacity: parsed.capacity } : {}),
        manage_available_windows: parsed.manage_available_windows,
      });
      toast.success('Resource calendar created', {
        description: `"${parsed.name}" is now available to book.`,
      });
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to create resource calendar', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a resource calendar</DialogTitle>
          <DialogDescription>
            A shared bookable resource — a room, equipment, or anything members
            can reserve when creating events.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className='flex flex-col gap-4' noValidate>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resource name</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      placeholder='Conference Room A'
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
                      placeholder='Seats 20, projector, whiteboard'
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
              name='capacity'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      placeholder='Maximum attendees'
                      autoComplete='off'
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    The maximum number of attendees this resource can
                    accommodate.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='manage_available_windows'
              render={({ field }) => (
                <FormItem>
                  <HStack gap={3} align='center' justify='between'>
                    <div className='space-y-0.5'>
                      <FormLabel>Manage availability windows</FormLabel>
                      <FormDescription>
                        Let this resource define its own bookable time windows.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label='Manage availability windows'
                      />
                    </FormControl>
                  </HStack>
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
                {isPending ? 'Creating…' : 'Create resource calendar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
