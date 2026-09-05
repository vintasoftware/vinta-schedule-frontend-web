'use client';

/**
 * PoolDialog — create or edit a calendar pool.
 *
 * A pool is a name, an optional description, and a roster of calendars. Both
 * modes submit the roster as a whole list, because the API replaces it
 * wholesale rather than applying a delta.
 *
 * Edit mode carries a warning the create mode does not: the roster is projected
 * into every group slot the pool is attached to, so adding a calendar here
 * makes it bookable in all of them and removing one takes it out of all of
 * them. Removals never fail and never touch existing bookings — those keep the
 * calendars they already hold (see the API's lenient-removal contract).
 */

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
} from 'vinta-schedule-design-system/ui/dialog';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Textarea } from 'vinta-schedule-design-system/ui/textarea';
import { Combobox } from 'vinta-schedule-design-system/ui/combobox';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormRootMessage,
} from 'vinta-schedule-design-system/ui/form';
import { FormLayout, VStack, Text } from 'vinta-schedule-design-system/layout';
import { useAllCalendars } from '@/hooks/calendars/use-all-calendars';
import {
  useCreateCalendarPool,
  useUpdateCalendarPool,
  type CalendarPool,
} from '@/hooks/calendar-pools/use-calendar-pools';
import { handleMutationError } from '@/lib/utils/form-errors';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const poolSchema = z.object({
  name: z.string().trim().min(1, { message: 'Pool name is required' }),
  description: z.string().optional(),
  calendar_ids: z
    .array(z.number())
    .min(1, { message: 'A pool needs at least one calendar' }),
});

type PoolFormValues = z.infer<typeof poolSchema>;

/** One page wide enough to offer every calendar an org realistically has. */
const CALENDARS_PAGE_SIZE = 200;

function getDefaultValues(pool: CalendarPool | null): PoolFormValues {
  return {
    name: pool?.name ?? '',
    description: pool?.description ?? '',
    calendar_ids: pool?.calendars.map((c) => c.id) ?? [],
  };
}

// ---------------------------------------------------------------------------
// PoolDialog
// ---------------------------------------------------------------------------

export interface PoolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The pool being edited; omit or pass null to create a new one. */
  pool?: CalendarPool | null;
}

export function PoolDialog({
  open,
  onOpenChange,
  pool = null,
}: PoolDialogProps) {
  const isEdit = pool !== null;

  const { calendars, isLoading: calendarsLoading } = useAllCalendars({
    page: 1,
    pageSize: CALENDARS_PAGE_SIZE,
    ordering: null,
    search: null,
  });

  const { createCalendarPool, createPoolMutation } = useCreateCalendarPool();
  const { updateCalendarPool, updatePoolMutation } = useUpdateCalendarPool();

  const form = useForm<PoolFormValues>({
    resolver: zodResolver(poolSchema),
    defaultValues: getDefaultValues(pool),
  });

  // Re-seed whenever the dialog opens, and whenever it is handed a different
  // pool — the table reuses one mounted dialog for every row's Edit action, so
  // the form would otherwise keep the previously edited pool's values.
  React.useEffect(() => {
    form.reset(getDefaultValues(pool));
  }, [open, pool, form]);

  const isPending =
    createPoolMutation.isPending || updatePoolMutation.isPending;

  const calendarIds = form.watch('calendar_ids');

  const onSubmit = async (values: PoolFormValues) => {
    const body = {
      name: values.name,
      description: values.description ?? '',
      calendar_ids: values.calendar_ids,
    };

    try {
      if (isEdit) {
        await updateCalendarPool(pool.id, body);
        toast.success('Calendar pool updated', {
          description: `"${values.name}" now has ${values.calendar_ids.length} calendar${
            values.calendar_ids.length === 1 ? '' : 's'
          }.`,
        });
      } else {
        await createCalendarPool(body);
        toast.success('Calendar pool created', {
          description: `"${values.name}" can now be attached to group slots.`,
        });
      }
      onOpenChange(false);
    } catch (err) {
      handleMutationError(err, {
        title: isEdit
          ? 'Failed to update calendar pool'
          : 'Failed to create calendar pool',
        form,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* shadcn internal: DialogContent exposes no size/scroll props. */}
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit calendar pool' : 'New calendar pool'}
          </DialogTitle>
          <DialogDescription>
            A pool is a reusable roster of calendars you can attach to the slots
            of any calendar group. Editing the roster here changes every group
            using it.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <FormRootMessage />
          <FormLayout onSubmit={form.handleSubmit(onSubmit)} gap={4} noValidate>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pool name</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      placeholder='e.g. Nurses'
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
                    <Textarea
                      rows={2}
                      placeholder='What is this pool used for?'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='calendar_ids'
              render={() => (
                <FormItem>
                  <FormLabel htmlFor='pool-calendars'>Calendars</FormLabel>
                  <FormControl>
                    <Combobox
                      id='pool-calendars'
                      multiple
                      options={calendars.map((cal) => ({
                        value: String(cal.id),
                        label: cal.name,
                      }))}
                      value={calendarIds.map(String)}
                      onValueChange={(values) =>
                        form.setValue(
                          'calendar_ids',
                          values.map((v) => parseInt(v, 10)),
                          { shouldValidate: true }
                        )
                      }
                      isLoading={calendarsLoading}
                      disabled={isPending}
                      placeholder='Select calendars…'
                      emptyText='No calendars found.'
                    />
                  </FormControl>
                  <FormDescription>
                    Every group slot this pool is attached to offers these
                    calendars.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEdit ? (
              <VStack gap={1} p={3} border radius='md'>
                <Text size='sm' weight='medium'>
                  This roster is shared
                </Text>
                <Text size='xs' color='muted-foreground'>
                  Adding a calendar makes it bookable in every group slot using
                  this pool; removing one takes it out of all of them.
                  Appointments already booked keep the calendars they hold.
                </Text>
              </VStack>
            ) : null}

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={isPending || calendarsLoading}
                data-testid='pool-submit'
              >
                {isPending
                  ? isEdit
                    ? 'Saving…'
                    : 'Creating…'
                  : isEdit
                    ? 'Save pool'
                    : 'Create pool'}
              </Button>
            </DialogFooter>
          </FormLayout>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
