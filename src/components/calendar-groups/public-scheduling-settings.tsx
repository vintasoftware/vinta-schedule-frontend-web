'use client';

/**
 * PublicSchedulingSettings — the group detail view's admin-only control for
 * `CalendarGroup.accepts_public_scheduling` and `CalendarGroup.duration`.
 *
 * Both fields are edited in one form and submitted as at most one `PATCH`
 * (`useUpdateCalendarGroupPublicScheduling`), carrying only the field(s) that
 * actually changed since the last load/save. This matters because
 * `CalendarGroupSerializer` treats an OMITTED field as "leave unchanged" but
 * an explicit `null` as a validation error — there is no way to "clear" a
 * duration, so resending an untouched field is harmless but resending it as
 * `null` would break the request outright. See the plan's tri-state guiding
 * decision.
 *
 * `duration` travels the wire as a Django `DurationField` string
 * (`"HH:MM:SS"`), never seconds — `@/lib/booking-links/duration-format` is
 * the sole place that converts to/from the plain number of minutes this form
 * edits.
 *
 * Gating: the controls are visible to every viewer of the group detail page,
 * but only enabled for an org admin (`organizations.manage_members`, mirrored
 * from `useHasPermission`). This is presentation only — the server's
 * `CalendarGroupPermission` refuses a non-admin's whole PATCH with a bare
 * `403`, it does not silently drop the disallowed fields — so a non-admin
 * must never be given a control that looks submittable. The submit button
 * itself is only rendered for an admin, rather than rendered-but-disabled,
 * so there is nothing on screen that implies a partial save is possible.
 *
 * Enabling with an unset length is a 400 the server would otherwise return
 * ("Enabling with no duration is a server 400" guiding decision) — blocked
 * here by a zod refine so the request is never sent at all.
 *
 * A group already public with a `null`/unset `duration` is grandfathered at
 * rest (the backend accepted it before this constraint, or before this
 * field existed) and refused at booking time. That state renders as a
 * warning here rather than as a healthy "public" toggle, so an admin isn't
 * misled into thinking the group is actually bookable.
 *
 * Failure path: a bare `{"detail": ...}` body (the shape of both a stray
 * validation error and the non-admin `403`) is not field-shaped, so
 * `handleMutationError` falls through to `toast.error` — and this app mounts
 * no `<Toaster />`. Forced onto the form root instead, following the same
 * pattern `mint-booking-link-dialog.tsx` established in Phase 4.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TriangleAlert } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from 'vinta-schedule-design-system/ui/card';
import { Switch } from 'vinta-schedule-design-system/ui/switch';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Alert, AlertDescription } from 'vinta-schedule-design-system/ui/alert';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
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
import {
  Box,
  HStack,
  VStack,
  Text,
  FormLayout,
} from 'vinta-schedule-design-system/layout';
import type { CalendarGroup } from '@/client';
import {
  useHasPermission,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';
import { useUpdateCalendarGroupPublicScheduling } from '@/hooks/calendar-groups/use-update-calendar-group-public-scheduling';
import {
  djangoDurationToMinutes,
  minutesToDjangoDuration,
  groupDurationIsUnset,
} from '@/lib/booking-links/duration-format';
import { handleMutationError } from '@/lib/utils/form-errors';

// ---------------------------------------------------------------------------
// Form schema — a plain number of minutes; enabling requires a positive one.
// ---------------------------------------------------------------------------

const publicSchedulingFormSchema = z
  .object({
    enabled: z.boolean(),
    durationMinutes: z
      .number({ message: 'Enter a number of minutes' })
      .int({ message: 'Whole numbers only' })
      .min(0, { message: 'Must be 0 or more' }),
  })
  .refine((values) => !values.enabled || values.durationMinutes > 0, {
    message:
      'Set an appointment length before enabling public scheduling — the server rejects enabling it with no duration set.',
    path: ['durationMinutes'],
  });

type PublicSchedulingFormValues = z.infer<typeof publicSchedulingFormSchema>;

function valuesFromGroup(group: CalendarGroup): PublicSchedulingFormValues {
  return {
    enabled: Boolean(group.accepts_public_scheduling),
    durationMinutes: djangoDurationToMinutes(group.duration),
  };
}

export interface PublicSchedulingSettingsProps {
  group: CalendarGroup;
}

export function PublicSchedulingSettings({
  group,
}: PublicSchedulingSettingsProps) {
  // Mirrors the server's admin-only rule for these two fields
  // (`CalendarGroupPermission`) — NOT the owner-or-admin rule
  // `canEditCalendar` / `canMintBookingLinkForGroup` use elsewhere on this
  // page. A member who owns every calendar in the group still cannot flip
  // this toggle; only `organizations.manage_members` can.
  const canManage = useHasPermission(PERMISSIONS.manageMembers);

  const { updatePublicScheduling, updatePublicSchedulingMutation } =
    useUpdateCalendarGroupPublicScheduling(String(group.id));

  const defaultValues = React.useMemo(() => valuesFromGroup(group), [group]);
  // The last values known to match the server, so `onSubmit` can diff
  // against them and omit whichever field didn't actually change — never
  // "resend" a field just because the form still holds a value for it.
  // Plain state rather than a ref: it needs to advance immediately after a
  // successful save (before the invalidated query refetches and `group`
  // itself catches up), and reading it from `onSubmit` keeps this a normal
  // state read rather than a ref access from a callback the compiler can't
  // prove runs outside render.
  const [savedValues, setSavedValues] =
    React.useState<PublicSchedulingFormValues>(defaultValues);

  const form = useForm<PublicSchedulingFormValues>({
    resolver: zodResolver(publicSchedulingFormSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (form.formState.isDirty) return;
    form.reset(defaultValues);
    setSavedValues(defaultValues);
  }, [defaultValues, form]);

  const isPending = updatePublicSchedulingMutation.isPending;

  // Grandfathered state: public at rest with no usable length. Read
  // straight off `group`, not local form state — this warns about the
  // server's current truth, not whatever the admin is mid-editing.
  const isGrandfathered =
    Boolean(group.accepts_public_scheduling) &&
    groupDurationIsUnset(group.duration);

  const onSubmit = async (values: PublicSchedulingFormValues) => {
    const body: { accepts_public_scheduling?: boolean; duration?: string } = {};
    if (values.enabled !== savedValues.enabled) {
      body.accepts_public_scheduling = values.enabled;
    }
    if (values.durationMinutes !== savedValues.durationMinutes) {
      body.duration = minutesToDjangoDuration(values.durationMinutes);
    }
    // Nothing actually changed (e.g. a resubmit with identical values) —
    // an empty PATCH is pointless and would still round-trip through the
    // "omit, don't send null" contract for no reason.
    if (Object.keys(body).length === 0) {
      return;
    }

    try {
      await updatePublicScheduling(body);
      setSavedValues(values);
      form.reset(values);
    } catch (err) {
      // See the file-level doc comment: a bare `{"detail": ...}` (including
      // the non-admin 403) isn't field-shaped, so `handleMutationError`
      // would otherwise only toast it — and this app mounts no `<Toaster
      // />`. Force it onto the form root instead.
      const description = handleMutationError(err, {
        title: 'Failed to save public scheduling settings',
        form,
      });
      if (description) {
        form.setError('root', { message: description });
      }
    }
  };

  return (
    <Card data-testid='public-scheduling-settings'>
      <CardHeader>
        <CardTitle>Public scheduling</CardTitle>
        <CardDescription>
          Let anyone holding this group&apos;s link book an appointment without
          a code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VStack gap={4}>
          {isGrandfathered ? (
            <Alert
              variant='warning'
              data-testid='grandfathered-duration-warning'
            >
              <Icon icon={TriangleAlert} size='sm' />
              <AlertDescription>
                This group is public but has no appointment length set —
                bookings will fail until a length is set below.
              </AlertDescription>
            </Alert>
          ) : null}

          {!canManage ? (
            <Text size='sm' color='muted-foreground'>
              Only an organization admin can change these settings.
            </Text>
          ) : null}

          <Form {...form}>
            <FormRootMessage />
            <FormLayout
              onSubmit={form.handleSubmit(onSubmit)}
              gap={4}
              noValidate
            >
              <FormField
                control={form.control}
                name='enabled'
                render={({ field }) => (
                  <FormItem>
                    <HStack gap={4} align='center' justify='between'>
                      <Box grow>
                        <FormLabel className='text-base font-semibold'>
                          Accept public bookings
                        </FormLabel>
                        <FormDescription>
                          Anyone holding the group&apos;s public link can book
                          without a code.
                        </FormDescription>
                      </Box>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={!canManage || isPending}
                          aria-label='Accept public bookings'
                        />
                      </FormControl>
                    </HStack>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='durationMinutes'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Appointment length (minutes)</FormLabel>
                    <Box width={128}>
                      <FormControl>
                        <Input
                          type='number'
                          min={0}
                          step={1}
                          inputMode='numeric'
                          disabled={!canManage || isPending}
                          aria-label='Appointment length in minutes'
                          value={Number.isNaN(field.value) ? '' : field.value}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ''
                                ? Number.NaN
                                : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                    </Box>
                    <FormDescription>
                      Applies to every booking made through this group&apos;s
                      links — there is no per-link duration for a group.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {canManage ? (
                <Button
                  type='submit'
                  disabled={isPending}
                  data-testid='save-public-scheduling-settings'
                >
                  {isPending ? 'Saving…' : 'Save'}
                </Button>
              ) : null}
            </FormLayout>
          </Form>
        </VStack>
      </CardContent>
    </Card>
  );
}
