'use client';

/**
 * AttendeeForm — collects the external attendee's contact details for a
 * public booking write.
 *
 * Field shape mirrors `BookingCodeExternalAttendee` exactly (checked against
 * the generated type, `@/client/types.gen.ts`): `email` is required, `name`
 * is optional. Nothing else about the attendee is asked here — `title` for
 * the created event is a fixed constant the flow supplies (see
 * `public-booking-flow.tsx`), not something an anonymous attendee picks.
 *
 * TIMEZONE moved OUT of this form (polish pass) — it used to be a field
 * here, discovered only after the attendee had already read every time on
 * the slot picker in some other (browser-default) zone, so changing it here
 * could retroactively contradict a time they'd already committed to. The
 * zone is now chosen/changed on `slot-picker.tsx`, at the point where times
 * are actually read, and threaded straight through as the flow's own
 * `timezone` state — this form only displays it for reassurance
 * (`timezone` prop), never edits it.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormRootMessage,
} from 'vinta-schedule-design-system/ui/form';
import { FormLayout, HStack, Text } from 'vinta-schedule-design-system/layout';
import { timezoneDisplayLabel } from '@/lib/booking-links/timezone-options';

export const attendeeFormSchema = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.email({ message: 'Enter a valid email address' }),
});

export type AttendeeFormValues = z.infer<typeof attendeeFormSchema>;

export interface AttendeeFormProps {
  /**
   * The zone already chosen on the slot picker — shown here for
   * reassurance only (see the module doc comment). Not editable in this
   * form; the flow submits this same value alongside these form values.
   */
  timezone: string;
  isSubmitting?: boolean;
  onSubmit: (values: AttendeeFormValues) => void | Promise<void>;
  /** Return to slot selection — omitted hides the button. */
  onBack?: () => void;
}

export function AttendeeForm({
  timezone,
  isSubmitting = false,
  onSubmit,
  onBack,
}: AttendeeFormProps) {
  const form = useForm<AttendeeFormValues>({
    resolver: zodResolver(attendeeFormSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Form {...form}>
      <FormRootMessage />
      <FormLayout onSubmit={handleSubmit} gap={4} noValidate>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder='Jane Doe'
                  autoComplete='name'
                  {...field}
                  data-testid='attendee-name-input'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type='email'
                  placeholder='you@example.com'
                  autoComplete='email'
                  {...field}
                  data-testid='attendee-email-input'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Text
          size='sm'
          color='muted-foreground'
          data-testid='attendee-form-timezone-note'
        >
          Booking in {timezoneDisplayLabel(timezone)}.
        </Text>

        <HStack gap={2} justify='end'>
          {onBack ? (
            <Button
              type='button'
              variant='outline'
              onClick={onBack}
              disabled={isSubmitting}
              data-testid='attendee-form-back'
            >
              Back
            </Button>
          ) : null}
          <Button
            type='submit'
            disabled={isSubmitting}
            data-testid='attendee-form-submit'
          >
            {isSubmitting ? 'Booking…' : 'Confirm booking'}
          </Button>
        </HStack>
      </FormLayout>
    </Form>
  );
}
