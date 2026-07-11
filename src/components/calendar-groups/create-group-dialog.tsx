'use client';

/**
 * CreateGroupDialog — admin form to build a new Calendar Group.
 *
 * Fields:
 *   - name (required)
 *   - description (optional)
 *   - slots (useFieldArray, ≥1 slot required)
 *     Each slot:
 *       - name (required)
 *       - required_count (number, min 1; must not exceed the pool size)
 *       - calendar_ids (multi-select via checkboxes from org calendars, ≥1 required)
 *
 * Validation (zod + cross-field refinements):
 *   - At least 1 slot
 *   - Each slot: ≥1 calendar in pool
 *   - Each slot: required_count ≤ pool size
 *
 * On submit → useCreateCalendarGroup; toast success/error; close on success.
 * Submit button disabled while pending.
 */

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
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
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from 'vinta-schedule-design-system/ui/form';
import { VStack, HStack, Text } from 'vinta-schedule-design-system/layout';
import { useAllCalendars } from '@/hooks/calendars/use-all-calendars';
import { useCreateCalendarGroup } from '@/hooks/calendar-groups/use-create-calendar-group';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const slotSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Slot name is required' }),
    required_count: z
      .number({ error: 'Required count must be a number' })
      .int()
      .min(1, { message: 'Required count must be at least 1' }),
    calendar_ids: z
      .array(z.number())
      .min(1, { message: 'At least one calendar must be in the pool' }),
  })
  .refine((data) => data.required_count <= data.calendar_ids.length, {
    message: 'Required count cannot exceed pool size',
    path: ['required_count'],
  });

const createGroupSchema = z.object({
  name: z.string().trim().min(1, { message: 'Group name is required' }),
  description: z.string().optional(),
  slots: z
    .array(slotSchema)
    .min(1, { message: 'At least one slot is required' }),
});

type CreateGroupFormValues = z.infer<typeof createGroupSchema>;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_SLOT = { name: '', required_count: 1, calendar_ids: [] };

function getDefaultValues(): CreateGroupFormValues {
  return {
    name: '',
    description: '',
    slots: [{ ...DEFAULT_SLOT }],
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// CreateGroupDialog
// ---------------------------------------------------------------------------

export function CreateGroupDialog({
  open,
  onOpenChange,
}: CreateGroupDialogProps) {
  // Fetch all org calendars for the pool pickers.
  const { calendars, isLoading: calendarsLoading } = useAllCalendars({
    page: 1,
    pageSize: 200,
    ordering: null,
    search: null,
  });

  const { createCalendarGroup, createCalendarGroupMutation } =
    useCreateCalendarGroup();

  const form = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: getDefaultValues(),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'slots',
  });

  // Reset when the dialog closes.
  React.useEffect(() => {
    if (!open) {
      form.reset(getDefaultValues());
    }
  }, [open, form]);

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const onSubmit = async (values: CreateGroupFormValues) => {
    try {
      await createCalendarGroup({
        name: values.name,
        description: values.description ?? undefined,
        slots: values.slots.map((slot) => ({
          name: slot.name,
          required_count: slot.required_count,
          calendar_ids: slot.calendar_ids,
        })),
      });
      toast.success('Calendar group created', {
        description: `"${values.name}" is now available for booking.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to create calendar group', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  };

  const isPending = createCalendarGroupMutation.isPending;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>New calendar group</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col gap-4'
            noValidate
          >
            {/* Group name */}
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group name</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      placeholder='e.g. Frontend Team'
                      autoComplete='off'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      placeholder='What is this group used for?'
                      autoComplete='off'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Slots */}
            <VStack gap={3}>
              <HStack gap={2} align='center' justify='between'>
                <Text size='sm' className='font-medium'>
                  Slots
                </Text>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => append({ ...DEFAULT_SLOT })}
                  disabled={isPending}
                >
                  <Plus className='mr-1 h-4 w-4' />
                  Add slot
                </Button>
              </HStack>

              {/* Slots-level error (< 1 slot) */}
              {form.formState.errors.slots?.root && (
                <Text size='xs' color='destructive'>
                  {form.formState.errors.slots.root.message}
                </Text>
              )}
              {/* Zod array-level message (also shows as .message directly) */}
              {typeof form.formState.errors.slots?.message === 'string' && (
                <Text size='xs' color='destructive'>
                  {form.formState.errors.slots.message}
                </Text>
              )}

              {fields.map((fieldItem, index) => (
                <SlotEditor
                  key={fieldItem.id}
                  index={index}
                  form={form}
                  calendars={calendars}
                  calendarsLoading={calendarsLoading}
                  isPending={isPending}
                  onRemove={() => remove(index)}
                  canRemove={fields.length > 1}
                />
              ))}
            </VStack>

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
                data-testid='create-group-submit'
              >
                {isPending ? 'Creating…' : 'Create group'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SlotEditor — one slot's editable row inside the form.
// ---------------------------------------------------------------------------

import type { UseFormReturn } from 'react-hook-form';
import type { Calendar } from '@/client';

interface SlotEditorProps {
  index: number;
  form: UseFormReturn<CreateGroupFormValues>;
  calendars: Calendar[];
  calendarsLoading: boolean;
  isPending: boolean;
  onRemove: () => void;
  canRemove: boolean;
}

function SlotEditor({
  index,
  form,
  calendars,
  calendarsLoading,
  isPending,
  onRemove,
  canRemove,
}: SlotEditorProps) {
  const calendarIds = form.watch(`slots.${index}.calendar_ids`);

  return (
    <VStack
      gap={3}
      p={3}
      border
      radius='md'
      data-testid={`slot-editor-${index}`}
    >
      {/* Slot header row */}
      <HStack gap={2} align='center' justify='between'>
        <Text size='sm' className='font-semibold'>
          Slot {index + 1}
        </Text>
        {canRemove && (
          <Button
            type='button'
            size='icon'
            variant='ghost'
            aria-label={`Remove slot ${index + 1}`}
            onClick={onRemove}
            disabled={isPending}
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        )}
      </HStack>

      {/* Slot name */}
      <FormField
        control={form.control}
        name={`slots.${index}.name`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Slot name</FormLabel>
            <FormControl>
              <Input
                type='text'
                placeholder='e.g. Interviewer'
                autoComplete='off'
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Required count */}
      <FormField
        control={form.control}
        name={`slots.${index}.required_count`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Required count</FormLabel>
            <FormControl>
              <Input
                type='number'
                min={1}
                max={calendars.length || 100}
                {...field}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
            </FormControl>
            <Text size='xs' color='muted-foreground'>
              How many calendars must be picked from this slot&apos;s pool when
              booking.
            </Text>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Calendar pool (multi-select combobox) */}
      <VStack gap={2}>
        <label
          htmlFor={`slot-${index}-calendar-pool`}
          className='text-sm leading-none font-medium'
        >
          Calendar pool
        </label>

        <Combobox
          id={`slot-${index}-calendar-pool`}
          multiple
          options={calendars.map((cal) => ({
            value: String(cal.id),
            label: cal.name,
          }))}
          value={calendarIds.map(String)}
          onValueChange={(values) =>
            form.setValue(
              `slots.${index}.calendar_ids`,
              values.map((v) => parseInt(v, 10)),
              { shouldValidate: true }
            )
          }
          isLoading={calendarsLoading}
          disabled={isPending}
          placeholder='Select calendars…'
          emptyText='No calendars found.'
        />

        {/* Pool error */}
        {form.formState.errors.slots?.[index]?.calendar_ids && (
          <Text size='xs' color='destructive'>
            {form.formState.errors.slots[index]?.calendar_ids?.message}
          </Text>
        )}
      </VStack>
    </VStack>
  );
}
