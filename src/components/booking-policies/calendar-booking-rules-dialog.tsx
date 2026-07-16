'use client';

/**
 * CalendarBookingRulesDialog — self-service editor for a single calendar's
 * booking policy.
 *
 * Unlike the admin BookingPolicyDialog, the target here is fixed (this
 * calendar), so there's no target picker — just the four guardrails. The
 * backend authorizes a non-admin member to CRUD a policy for a calendar they
 * own, so this is the member-facing path opened from the calendars table.
 *
 * The dialog resolves the calendar's existing policy on open:
 *   - none  → create a new policy targeting this calendar.
 *   - exists → edit its rule fields (PATCH), with a "Remove rules" action that
 *     deletes the policy (falling resolution through to membership / org default).
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
import { Form, FormField } from 'vinta-schedule-design-system/ui/form';
import { Spacer, Text, FormLayout } from 'vinta-schedule-design-system/layout';
import {
  useCreateBookingPolicy,
  useUpdateBookingPolicy,
  useDeleteBookingPolicy,
} from '@/hooks/booking-policies/use-booking-policies';
import { useCalendarBookingPolicy } from '@/hooks/booking-policies/use-calendar-booking-policy';
import {
  DurationFormField,
  durationFieldSchema,
  ruleValuesFromSeconds,
  ruleValuesToSeconds,
  RULE_FIELDS,
  ZERO_DURATION,
  type RuleFormValues,
} from './rule-fields';

const rulesSchema = z.object({
  lead_time: durationFieldSchema,
  max_horizon: durationFieldSchema,
  buffer_before: durationFieldSchema,
  buffer_after: durationFieldSchema,
});

type RulesSchema = z.infer<typeof rulesSchema>;

const DEFAULT_VALUES: RuleFormValues = {
  lead_time: { ...ZERO_DURATION },
  max_horizon: { ...ZERO_DURATION },
  buffer_before: { ...ZERO_DURATION },
  buffer_after: { ...ZERO_DURATION },
};

interface CalendarBookingRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: number;
  calendarName: string;
}

export function CalendarBookingRulesDialog({
  open,
  onOpenChange,
  calendarId,
  calendarName,
}: CalendarBookingRulesDialogProps) {
  const { policy, isLoading } = useCalendarBookingPolicy(
    open ? calendarId : null
  );
  const { createBookingPolicy, createMutation } = useCreateBookingPolicy();
  const { updateBookingPolicy, updateMutation } = useUpdateBookingPolicy();
  const { deleteBookingPolicy, deleteMutation } = useDeleteBookingPolicy();

  const hasPolicy = policy !== null;

  const form = useForm<RulesSchema>({
    resolver: zodResolver(rulesSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Populate from the resolved policy once it loads (or reset to zeros on close
  // / when the calendar has no policy yet).
  React.useEffect(() => {
    if (open) {
      form.reset(policy ? ruleValuesFromSeconds(policy) : DEFAULT_VALUES);
    } else {
      form.reset(DEFAULT_VALUES);
    }
  }, [open, policy, form]);

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const onSubmit = async (values: RulesSchema) => {
    const ruleFields = ruleValuesToSeconds(values);
    try {
      if (policy) {
        await updateBookingPolicy(policy.id, ruleFields);
        toast.success('Booking rules updated');
      } else {
        await createBookingPolicy({ calendar: calendarId, ...ruleFields });
        toast.success('Booking rules saved');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to save booking rules', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  };

  const onRemove = async () => {
    if (!policy) return;
    try {
      await deleteBookingPolicy(policy.id);
      toast.success('Booking rules removed');
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to remove booking rules', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Booking rules</DialogTitle>
          <DialogDescription>
            Guardrails for <Text weight='medium'>{calendarName}</Text> — lead
            time, booking horizon, and buffers around existing events. Set any
            rule to 0 to leave it unconstrained.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Text size='sm' color='muted-foreground'>
            Loading current rules…
          </Text>
        ) : (
          <Form {...form}>
            <FormLayout
              onSubmit={form.handleSubmit(onSubmit)}
              gap={4}
              noValidate
            >
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

              {/* shadcn DialogFooter is a bare flex row with no align prop. */}
              <DialogFooter className='items-center'>
                {hasPolicy && (
                  <Button
                    type='button'
                    variant='outline'
                    onClick={onRemove}
                    disabled={isPending}
                    // A destructive *outline* button: Button's `destructive`
                    // variant is solid-filled, and the :hover lock has no prop.
                    className='text-destructive hover:text-destructive'
                  >
                    Remove rules
                  </Button>
                )}
                <Spacer />
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
                  data-testid='calendar-booking-rules-submit'
                >
                  {isPending ? 'Saving…' : 'Save rules'}
                </Button>
              </DialogFooter>
            </FormLayout>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
