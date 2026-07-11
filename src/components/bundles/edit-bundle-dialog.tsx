'use client';

/**
 * EditBundleDialog — admin form to update a Calendar Bundle's children and primary.
 *
 * Pre-populated from the current bundle's children_calendars and primary_calendar.
 *
 * Fields:
 *   - bundle_calendars (multi-select checkboxes, ≥1 required)
 *   - primary_calendar (single-select radio among chosen calendars, required)
 *
 * Validation (zod + cross-field refinements):
 *   - bundle_calendars: ≥1 calendar selected
 *   - primary_calendar: must be selected AND must be ∈ bundle_calendars
 *
 * IMPORTANT: The API patch operation does NOT support name updates; only
 * bundle_calendars and primary_calendar are patchable. Name is read-only.
 *
 * On submit → useUpdateBundle; toast success/error; close on success.
 * Submit button disabled while pending.
 */

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { Calendar } from '@/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@vinta-schedule/design-system/ui/dialog';
import { Button } from '@vinta-schedule/design-system/ui/button';
import { Checkbox } from '@vinta-schedule/design-system/ui/checkbox';
import {
  RadioGroup,
  RadioGroupItem,
} from '@vinta-schedule/design-system/ui/radio-group';
import { Form } from '@vinta-schedule/design-system/ui/form';
import { VStack, HStack, Text } from '@vinta-schedule/design-system/layout';
import { useAllCalendars } from '@/hooks/calendars/use-all-calendars';
import { useUpdateBundle } from '@/hooks/bundles/use-update-bundle';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const editBundleSchema = z
  .object({
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

type EditBundleFormValues = z.infer<typeof editBundleSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EditBundleDialogProps {
  bundle: Calendar;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Pre-populate bundle with current children and primary if available
  currentChildren?: number[];
  currentPrimary?: number | null;
}

// ---------------------------------------------------------------------------
// EditBundleDialog
// ---------------------------------------------------------------------------

export function EditBundleDialog({
  bundle,
  open,
  onOpenChange,
  currentChildren = [],
  currentPrimary = null,
}: EditBundleDialogProps) {
  // Fetch all org calendars for the bundle children picker.
  const { calendars, isLoading: calendarsLoading } = useAllCalendars({
    page: 1,
    pageSize: 200,
    ordering: null,
    search: null,
  });

  const { updateBundle, updateBundleMutation } = useUpdateBundle();

  const form = useForm<EditBundleFormValues>({
    resolver: zodResolver(editBundleSchema),
    defaultValues: {
      bundle_calendars: currentChildren,
      primary_calendar: currentPrimary,
    },
  });

  // Reset when the dialog closes or bundle/current values change.
  React.useEffect(() => {
    if (!open) {
      form.reset({
        bundle_calendars: currentChildren,
        primary_calendar: currentPrimary,
      });
    }
  }, [open, form, currentChildren, currentPrimary]);

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const onSubmit = async (values: EditBundleFormValues) => {
    try {
      await updateBundle(bundle.id, {
        bundle_calendars: values.bundle_calendars,
        primary_calendar: values.primary_calendar!,
      });
      toast.success('Bundle updated', {
        description: `"${bundle.name}" has been updated.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to update bundle', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  };

  const isPending = updateBundleMutation.isPending;
  const selectedCalendars = form.watch('bundle_calendars');

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Edit bundle: {bundle.name}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col gap-4'
            noValidate
          >
            {/* Child calendars (multi-select checkboxes) */}
            <VStack gap={3}>
              <label className='text-sm leading-none font-medium'>
                Child calendars
              </label>

              {calendarsLoading && (
                <Text size='xs' color='muted-foreground'>
                  Loading calendars…
                </Text>
              )}

              {!calendarsLoading && calendars.length === 0 && (
                <Text size='xs' color='muted-foreground'>
                  No calendars available.
                </Text>
              )}

              {!calendarsLoading && calendars.length > 0 && (
                <VStack gap={2}>
                  {calendars.map((cal) => {
                    const isChecked = selectedCalendars.includes(cal.id);
                    return (
                      <HStack key={cal.id} gap={2} align='center'>
                        <Controller
                          control={form.control}
                          name='bundle_calendars'
                          render={() => (
                            <Checkbox
                              id={`edit-bundle-cal-${cal.id}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                const current =
                                  form.getValues('bundle_calendars');
                                if (checked) {
                                  form.setValue(
                                    'bundle_calendars',
                                    [...current, cal.id],
                                    { shouldValidate: true }
                                  );
                                } else {
                                  form.setValue(
                                    'bundle_calendars',
                                    current.filter((id) => id !== cal.id),
                                    { shouldValidate: true }
                                  );
                                  // If the primary was this calendar, clear it.
                                  if (
                                    form.getValues('primary_calendar') ===
                                    cal.id
                                  ) {
                                    form.setValue('primary_calendar', null, {
                                      shouldValidate: true,
                                    });
                                  }
                                }
                              }}
                              aria-label={cal.name}
                            />
                          )}
                        />
                        <label
                          htmlFor={`edit-bundle-cal-${cal.id}`}
                          className='cursor-pointer text-sm select-none'
                        >
                          {cal.name}
                        </label>
                      </HStack>
                    );
                  })}
                </VStack>
              )}

              {/* Calendars error */}
              {form.formState.errors.bundle_calendars && (
                <Text size='xs' color='destructive'>
                  {form.formState.errors.bundle_calendars.message}
                </Text>
              )}
            </VStack>

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
                                id={`edit-primary-cal-${cal.id}`}
                              />
                              <label
                                htmlFor={`edit-primary-cal-${cal.id}`}
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
                data-testid='edit-bundle-submit'
              >
                {isPending ? 'Updating…' : 'Update bundle'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
