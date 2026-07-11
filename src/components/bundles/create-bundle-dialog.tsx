'use client';

/**
 * CreateBundleDialog — admin form to create a new Calendar Bundle.
 *
 * Fields:
 *   - name (required)
 *   - bundle_calendars (multi-select checkboxes, ≥1 required)
 *   - primary_calendar (single-select radio among chosen calendars, required)
 *
 * Validation (zod + cross-field refinements):
 *   - name: non-empty string
 *   - bundle_calendars: ≥1 calendar selected
 *   - primary_calendar: must be selected AND must be ∈ bundle_calendars
 *
 * On submit → useCreateBundle; toast success/error; close on success.
 * Submit button disabled while pending.
 */

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { Combobox } from 'vinta-schedule-design-system/ui/combobox';
import {
  RadioGroup,
  RadioGroupItem,
} from 'vinta-schedule-design-system/ui/radio-group';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from 'vinta-schedule-design-system/ui/form';
import { VStack, HStack, Text } from 'vinta-schedule-design-system/layout';
import { useAllCalendars } from '@/hooks/calendars/use-all-calendars';
import { useCreateBundle } from '@/hooks/bundles/use-create-bundle';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const createBundleSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Bundle name is required' }),
    bundle_calendars: z
      .array(z.number())
      .min(1, { message: 'At least one calendar must be selected' }),
    primary_calendar: z.number().nullable(),
  })
  .refine((data) => data.primary_calendar !== null, {
    message: 'A primary calendar must be selected',
    path: ['primary_calendar'],
  })
  .refine(
    (data) =>
      data.primary_calendar === null ||
      data.bundle_calendars.includes(data.primary_calendar),
    {
      message: 'Primary calendar must be one of the selected calendars',
      path: ['primary_calendar'],
    }
  );

type CreateBundleFormValues = z.infer<typeof createBundleSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreateBundleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// CreateBundleDialog
// ---------------------------------------------------------------------------

export function CreateBundleDialog({
  open,
  onOpenChange,
}: CreateBundleDialogProps) {
  // Fetch all org calendars for the bundle children picker.
  const { calendars, isLoading: calendarsLoading } = useAllCalendars({
    page: 1,
    pageSize: 200,
    ordering: null,
    search: null,
  });

  const { createBundle, createBundleMutation } = useCreateBundle();

  const form = useForm<CreateBundleFormValues>({
    resolver: zodResolver(createBundleSchema),
    defaultValues: {
      name: '',
      bundle_calendars: [],
      primary_calendar: null,
    },
  });

  // Reset when the dialog closes.
  React.useEffect(() => {
    if (!open) {
      form.reset({
        name: '',
        bundle_calendars: [],
        primary_calendar: null,
      });
    }
  }, [open, form]);

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const onSubmit = async (values: CreateBundleFormValues) => {
    try {
      await createBundle({
        name: values.name,
        bundle_calendars: values.bundle_calendars,
        primary_calendar: values.primary_calendar!,
      });
      toast.success('Bundle created', {
        description: `"${values.name}" is now available.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to create bundle', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  };

  const isPending = createBundleMutation.isPending;
  const selectedCalendars = form.watch('bundle_calendars');

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>New bundle</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col gap-4'
            noValidate
          >
            {/* Bundle name */}
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bundle name</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      placeholder='e.g. Main office calendars'
                      autoComplete='off'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Child calendars (combobox multi-select) */}
            <FormField
              control={form.control}
              name='bundle_calendars'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Child calendars</FormLabel>
                  <FormControl>
                    <Combobox
                      multiple
                      options={calendars.map((cal) => ({
                        value: cal.id.toString(),
                        label: cal.name,
                      }))}
                      value={field.value.map(String)}
                      onValueChange={(vals) => {
                        const newIds = vals.map(Number);
                        field.onChange(newIds);
                        const primary = form.getValues('primary_calendar');
                        if (primary !== null && !newIds.includes(primary)) {
                          form.setValue('primary_calendar', null, {
                            shouldValidate: true,
                          });
                        }
                      }}
                      placeholder='Select calendars…'
                      searchPlaceholder='Search calendars…'
                      emptyText='No calendars available.'
                      isLoading={calendarsLoading}
                      disabled={calendarsLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Primary calendar (radio select among chosen calendars) */}
            {selectedCalendars.length > 0 && (
              <VStack gap={3}>
                <label className='text-sm leading-none font-medium'>
                  Primary calendar
                </label>

                <Controller
                  control={form.control}
                  name='primary_calendar'
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value?.toString() ?? ''}
                      onValueChange={(value) => {
                        field.onChange(value ? parseInt(value, 10) : null);
                      }}
                    >
                      <VStack gap={2}>
                        {calendars
                          .filter((cal) => selectedCalendars.includes(cal.id))
                          .map((cal) => (
                            <HStack key={cal.id} gap={2} align='center'>
                              <RadioGroupItem
                                value={cal.id.toString()}
                                id={`primary-cal-${cal.id}`}
                              />
                              <label
                                htmlFor={`primary-cal-${cal.id}`}
                                className='cursor-pointer text-sm select-none'
                              >
                                {cal.name}
                              </label>
                            </HStack>
                          ))}
                      </VStack>
                    </RadioGroup>
                  )}
                />

                {/* Primary calendar error */}
                {form.formState.errors.primary_calendar && (
                  <Text size='xs' color='destructive'>
                    {form.formState.errors.primary_calendar.message}
                  </Text>
                )}
              </VStack>
            )}

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
                data-testid='create-bundle-submit'
              >
                {isPending ? 'Creating…' : 'Create bundle'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
