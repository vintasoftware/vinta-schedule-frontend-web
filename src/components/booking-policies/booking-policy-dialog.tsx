'use client';

/**
 * BookingPolicyDialog — create or edit a booking policy.
 *
 * A policy carries four guardrails (lead time, max horizon, buffer-before,
 * buffer-after) and attaches to exactly one target: a calendar, a calendar
 * group, a member, or the organization default.
 *
 * Create mode: the admin picks a target type, then (for entity-scoped types)
 * the entity, then the four durations. Exactly one target field is sent.
 *
 * Edit mode: targets are immutable on the backend, so the target type + entity
 * pickers are shown read-only and only the four rule fields are PATCHed.
 *
 * Durations are edited as {value, unit} pairs and converted to seconds at the
 * API boundary (see ./duration).
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
} from '@vinta-schedule/design-system/ui/dialog';
import { Button } from '@vinta-schedule/design-system/ui/button';
import { Combobox } from '@vinta-schedule/design-system/ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vinta-schedule/design-system/ui/select';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@vinta-schedule/design-system/ui/form';
import { Text } from '@vinta-schedule/design-system/layout';
import {
  useCreateBookingPolicy,
  useUpdateBookingPolicy,
  type BookingPolicy,
} from '@/hooks/booking-policies/use-booking-policies';
import {
  DurationFormField,
  durationFieldSchema,
  ruleValuesFromSeconds,
  ruleValuesToSeconds,
  RULE_FIELDS,
  ZERO_DURATION,
} from './rule-fields';
import {
  TARGET_TYPE_OPTIONS,
  buildTargetFields,
  getTargetEntityId,
  getTargetType,
  targetTypeLabel,
  targetTypeNeedsEntity,
  type BookingPolicyTargetType,
} from './target';
import { useTargetOptions } from './use-target-options';

// ---------------------------------------------------------------------------
// Zod schema
//
// Each rule field is a {value, unit} pair with a non-negative integer value.
// `entityId` is required only for entity-scoped target types; the cross-field
// rule is enforced in a superRefine so the message lands on the entity field.
// ---------------------------------------------------------------------------

const TARGET_TYPE_VALUES = TARGET_TYPE_OPTIONS.map((o) => o.value) as [
  BookingPolicyTargetType,
  ...BookingPolicyTargetType[],
];

const bookingPolicySchema = z
  .object({
    targetType: z.enum(TARGET_TYPE_VALUES),
    entityId: z.string().optional(),
    lead_time: durationFieldSchema,
    max_horizon: durationFieldSchema,
    buffer_before: durationFieldSchema,
    buffer_after: durationFieldSchema,
  })
  .superRefine((data, ctx) => {
    if (targetTypeNeedsEntity(data.targetType) && !data.entityId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Select a ${targetTypeLabel(data.targetType).toLowerCase()}`,
        path: ['entityId'],
      });
    }
  });

type BookingPolicySchema = z.infer<typeof bookingPolicySchema>;

const DEFAULT_VALUES: BookingPolicySchema = {
  targetType: 'calendar',
  entityId: undefined,
  lead_time: { ...ZERO_DURATION },
  max_horizon: { ...ZERO_DURATION },
  buffer_before: { ...ZERO_DURATION },
  buffer_after: { ...ZERO_DURATION },
};

function policyToFormValues(policy: BookingPolicy): BookingPolicySchema {
  const entityId = getTargetEntityId(policy);
  return {
    targetType: getTargetType(policy),
    entityId: entityId != null ? String(entityId) : undefined,
    ...ruleValuesFromSeconds(policy),
  };
}

// ---------------------------------------------------------------------------
// BookingPolicyDialog
// ---------------------------------------------------------------------------

interface BookingPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing policy to edit; omit for create mode. */
  policy?: BookingPolicy | null;
}

export function BookingPolicyDialog({
  open,
  onOpenChange,
  policy,
}: BookingPolicyDialogProps) {
  const isEdit = Boolean(policy);

  const { createBookingPolicy, createMutation } = useCreateBookingPolicy();
  const { updateBookingPolicy, updateMutation } = useUpdateBookingPolicy();
  const { calendarOptions, groupOptions, memberOptions, isLoading } =
    useTargetOptions();

  const form = useForm<BookingPolicySchema>({
    resolver: zodResolver(bookingPolicySchema),
    defaultValues: DEFAULT_VALUES,
  });

  React.useEffect(() => {
    if (open) {
      form.reset(policy ? policyToFormValues(policy) : DEFAULT_VALUES);
    } else {
      form.reset(DEFAULT_VALUES);
    }
  }, [open, policy, form]);

  const targetType = form.watch('targetType');
  const isPending = createMutation.isPending || updateMutation.isPending;

  const entityOptions =
    targetType === 'calendar'
      ? calendarOptions
      : targetType === 'calendar_group'
        ? groupOptions
        : memberOptions;

  const onSubmit = async (values: BookingPolicySchema) => {
    const ruleFields = ruleValuesToSeconds(values);

    try {
      if (isEdit && policy) {
        // Targets are immutable — only the rule fields are PATCHed.
        await updateBookingPolicy(policy.id, ruleFields);
        toast.success('Booking policy updated');
      } else {
        const entityId =
          targetTypeNeedsEntity(values.targetType) && values.entityId
            ? Number(values.entityId)
            : null;
        await createBookingPolicy({
          ...buildTargetFields(values.targetType, entityId),
          ...ruleFields,
        });
        toast.success('Booking policy created');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(
        isEdit
          ? 'Failed to update booking policy'
          : 'Failed to create booking policy',
        {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit booking policy' : 'New booking policy'}
          </DialogTitle>
          <DialogDescription>
            Booking policies add guardrails — lead time, booking horizon, and
            buffers around existing events — to slot discovery and booking.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col gap-4'
            noValidate
          >
            <FormField
              control={form.control}
              name='targetType'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Applies to</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Reset the entity when the target type changes so a stale
                      // id from another type can't leak into the create body.
                      form.setValue('entityId', undefined);
                    }}
                    disabled={isEdit}
                  >
                    <FormControl>
                      <SelectTrigger data-testid='booking-policy-target-type'>
                        <SelectValue placeholder='Select a target' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TARGET_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {
                      TARGET_TYPE_OPTIONS.find((t) => t.value === field.value)
                        ?.description
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {targetTypeNeedsEntity(targetType) && (
              <FormField
                control={form.control}
                name='entityId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{targetTypeLabel(targetType)}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={entityOptions}
                        value={field.value}
                        onValueChange={field.onChange}
                        isLoading={isLoading}
                        disabled={isEdit}
                        placeholder={`Select a ${targetTypeLabel(targetType).toLowerCase()}`}
                        searchPlaceholder='Search…'
                        aria-label={targetTypeLabel(targetType)}
                        aria-invalid={
                          form.formState.errors.entityId ? true : undefined
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Text weight='semibold' size='sm' className='mt-2'>
              Rules
            </Text>
            <Text size='sm' color='muted-foreground' className='-mt-2'>
              Set any rule to 0 to leave it unconstrained.
            </Text>

            {RULE_FIELDS.map((rule) => (
              <FormField
                key={rule.name}
                control={form.control}
                name={rule.name}
                render={({ field }) => (
                  <DurationFormField
                    field={field}
                    label={rule.label}
                    description={rule.description}
                  />
                )}
              />
            ))}

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
                disabled={isPending}
                data-testid='booking-policy-submit'
              >
                {isPending
                  ? isEdit
                    ? 'Saving…'
                    : 'Creating…'
                  : isEdit
                    ? 'Save changes'
                    : 'Create policy'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
