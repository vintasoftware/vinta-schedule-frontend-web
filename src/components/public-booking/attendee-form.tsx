'use client';

/**
 * AttendeeForm — collects the external attendee's contact details and
 * timezone for a public booking write.
 *
 * Field shape mirrors `BookingCodeExternalAttendee` exactly (checked against
 * the generated type, `@/client/types.gen.ts`): `email` is required, `name`
 * is optional. Nothing else about the attendee is asked here — `title` for
 * the created event is a fixed constant the flow supplies (see
 * `public-booking-flow.tsx`), not something an anonymous attendee picks.
 *
 * Timezone defaults to the browser's resolved zone
 * (`Intl.DateTimeFormat().resolvedOptions().timeZone`) with an explicit
 * override control, since `timezone` is required on the write and the
 * attendee may be booking on someone else's behalf in a different zone.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
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
import { FormLayout, HStack } from 'vinta-schedule-design-system/layout';

// A reasonably complete fallback for environments where
// `Intl.supportedValuesOf` isn't available (older engines / some test
// runners) — see `timezoneOptions` below.
const FALLBACK_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

/**
 * Every IANA zone the runtime knows about, via `Intl.supportedValuesOf` when
 * present (Node 18+ / evergreen browsers). Falls back to a short curated
 * list rather than throwing — a smaller picker beats a broken form.
 */
function timezoneOptions(): { value: string; label: string }[] {
  const supportedValuesOf = (
    Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }
  ).supportedValuesOf;
  const zones =
    typeof supportedValuesOf === 'function'
      ? supportedValuesOf('timeZone')
      : FALLBACK_TIMEZONES;
  return zones.map((zone) => ({ value: zone, label: zone }));
}

export const attendeeFormSchema = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.email({ message: 'Enter a valid email address' }),
  timezone: z.string().min(1, { message: 'Choose a timezone' }),
});

export type AttendeeFormValues = z.infer<typeof attendeeFormSchema>;

export interface AttendeeFormProps {
  /** Usually `Intl.DateTimeFormat().resolvedOptions().timeZone`. */
  defaultTimezone: string;
  isSubmitting?: boolean;
  onSubmit: (values: AttendeeFormValues) => void | Promise<void>;
  /** Return to slot selection — omitted hides the button. */
  onBack?: () => void;
}

export function AttendeeForm({
  defaultTimezone,
  isSubmitting = false,
  onSubmit,
  onBack,
}: AttendeeFormProps) {
  const options = React.useMemo(() => timezoneOptions(), []);

  const form = useForm<AttendeeFormValues>({
    resolver: zodResolver(attendeeFormSchema),
    defaultValues: {
      name: '',
      email: '',
      timezone: defaultTimezone,
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

        <FormField
          control={form.control}
          name='timezone'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Timezone</FormLabel>
              <FormControl>
                <Combobox
                  id='attendee-timezone'
                  options={options}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder='Select timezone'
                  searchPlaceholder='Search timezones…'
                />
              </FormControl>
              <FormDescription>
                Defaults to your device&apos;s timezone — change it if
                you&apos;re booking on someone else&apos;s behalf.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

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
