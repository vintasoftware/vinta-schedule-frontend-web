'use client';

/**
 * PublicSchedulingSettings — the appointment type detail view's admin-only control for
 * `AppointmentType.accepts_public_scheduling` and `AppointmentType.duration`.
 *
 * Both fields are edited in one form and submitted as at most one `PATCH`
 * (`useUpdateAppointmentTypePublicScheduling`), carrying only the field(s) that
 * actually changed since the last load/save. This matters because
 * `AppointmentTypeSerializer` treats an OMITTED field as "leave unchanged" but
 * an explicit `null` as a validation error — there is no way to "clear" a
 * duration, so resending an untouched field is harmless but resending it as
 * `null` would break the request outright. See the plan's tri-state guiding
 * decision.
 *
 * That tri-state applies to THESE TWO FIELDS ONLY. The rest of the body is not
 * partial: `AppointmentTypeSerializer` replaces `slots` wholesale with no
 * unchanged sentinel and refuses a partial update that omits it, reads `name`
 * unguarded, and defaults `description` to `""` (clearing it). So the changed
 * field(s) go through `buildAppointmentTypeUpdateBody`, which carries `name`,
 * `description` and the full `slots` list — each slot's inline roster split
 * back out from its attached pools — over from the appointment type as last read. A body
 * holding only the toggle and the duration is a 400, not a partial save.
 *
 * `duration` travels the wire as a Django `DurationField` string
 * (`"HH:MM:SS"`), never seconds — `@/lib/booking-links/duration-format` is
 * the sole place that converts to/from the plain number of minutes this form
 * edits.
 *
 * Gating: the controls are visible to every viewer of the appointment type detail page,
 * but only enabled for an org admin (`organizations.manage_members`, mirrored
 * from `useHasPermission`). This is presentation only — the server's
 * `AppointmentTypePermission` refuses a non-admin's whole PATCH with a bare
 * `403`, it does not silently drop the disallowed fields — so a non-admin
 * must never be given a control that looks submittable. The submit button
 * itself is only rendered for an admin, rather than rendered-but-disabled,
 * so there is nothing on screen that implies a partial save is possible.
 *
 * Enabling with an unset length is a 400 the server would otherwise return
 * ("Enabling with no duration is a server 400" guiding decision) — blocked
 * here by a zod refine so the request is never sent at all.
 *
 * An appointment type already public with a `null`/unset `duration` is grandfathered at
 * rest (the backend accepted it before this constraint, or before this
 * field existed) and refused at booking time. That state renders as a
 * warning here rather than as a healthy "public" toggle, so an admin isn't
 * misled into thinking the appointment type is actually bookable.
 *
 * Failure path: a bare `{"detail": ...}` body (the shape of both a stray
 * validation error and the non-admin `403`) is not field-shaped, so
 * `handleMutationError` falls through to `toast.error` — and this app mounts
 * no `<Toaster />`. Forced onto the form root instead, following the same
 * pattern `mint-booking-link-dialog.tsx` established in Phase 4.
 *
 * PHASE 7 — the reusable public link:
 *
 * `appointment type.public_booking_slug` is a `readonly` field on `AppointmentType`,
 * always present regardless of `accepts_public_scheduling` — the backend
 * mints it once at appointment type creation and never rotates it. Once Phase 7's
 * `/g/[public_slug]` (and branded `/o/[slug]/g/[public_slug]`) route
 * answers at that address, this settings panel is the one place a member
 * can find and copy it, via `buildAppointmentTypePublicBookingUrl`.
 *
 * UNLIKE every other link this feature produces (a minted booking code, or
 * a self-service reschedule/cancel code on the confirmation screen), this
 * link is NOT a one-time credential: it never expires, is never consumed,
 * and is safe to look at, copy, and show again as many times as needed. The
 * copy below says so explicitly, because a member who has seen this
 * feature's other one-time-reveal links would otherwise reasonably assume
 * the same about this one. It is shown regardless of whether public
 * scheduling is currently on — the slug itself is stable — but the section
 * says plainly when the link won't actually work yet (toggle off, or a
 * grandfathered public appointment type with no duration), so nobody copies a link
 * expecting it to already be live.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, CheckCheck, TriangleAlert } from 'lucide-react';
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
import type { AppointmentType } from '@/client';
import {
  useHasPermission,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';
import { useCurrentOrganization } from '@/hooks/organizations/use-current-organization';
import { useUpdateAppointmentTypePublicScheduling } from '@/hooks/appointment-types/use-update-appointment-type-public-scheduling';
import {
  djangoDurationToMinutes,
  minutesToDjangoDuration,
  appointmentTypeDurationIsUnset,
} from '@/lib/booking-links/duration-format';
import { buildAppointmentTypePublicBookingUrl } from '@/lib/booking-links/build-url';
import { buildAppointmentTypeUpdateBody } from '@/lib/appointment-types/appointment-type-payload';
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

function valuesFromAppointmentType(
  appointmentType: AppointmentType
): PublicSchedulingFormValues {
  return {
    enabled: Boolean(appointmentType.accepts_public_scheduling),
    durationMinutes: djangoDurationToMinutes(appointmentType.duration),
  };
}

/**
 * PublicAppointmentTypeLinkCard — the appointment type's stable, reusable `public_booking_slug`
 * link, rendered as its own card below the settings form.
 *
 * See the file-level "PHASE 7" doc comment for why this is NOT modeled as a
 * one-time reveal the way `mint-booking-link-dialog.tsx` and
 * `booking-confirmation.tsx`'s management links are — this link is safe to
 * show every time this page loads.
 */
function PublicAppointmentTypeLinkCard({
  appointmentType,
}: {
  appointmentType: AppointmentType;
}) {
  // Resolves the active org's slug for the branded URL only — never sent to
  // any request this component makes (it makes none). Same usage as
  // `mint-booking-link-dialog.tsx`.
  const { organization } = useCurrentOrganization();
  const rawSlug = organization?.slug;
  const slug = typeof rawSlug === 'string' ? rawSlug : undefined;

  const url = buildAppointmentTypePublicBookingUrl({
    publicSlug: appointmentType.public_booking_slug,
    slug,
  });

  const [copied, setCopied] = React.useState(false);
  const [copyFailed, setCopyFailed] = React.useState(false);
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  React.useEffect(
    () => () => {
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current);
      }
    },
    []
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyFailed(false);
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Still visible/selectable in the input even if the clipboard write
      // fails — surfaced inline since this app mounts no `<Toaster />`.
      setCopyFailed(true);
    }
  };

  const isPublic = Boolean(appointmentType.accepts_public_scheduling);
  const isGrandfathered =
    isPublic && appointmentTypeDurationIsUnset(appointmentType.duration);

  return (
    <Card data-testid='public-appointment-type-link-card'>
      <CardHeader>
        <CardTitle>Public scheduling link</CardTitle>
        <CardDescription>
          Unlike the codes this feature mints elsewhere, this link is stable and
          reusable — it never expires, is never consumed, and is safe to copy
          and share again any time. Anyone who has it can use it to book,
          repeatedly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VStack gap={3}>
          {!isPublic ? (
            <Text
              size='sm'
              color='muted-foreground'
              data-testid='public-appointment-type-link-inactive-toggle'
            >
              Public scheduling is off above, so this link won&apos;t work yet —
              turn it on to activate it.
            </Text>
          ) : isGrandfathered ? (
            <Text
              size='sm'
              color='muted-foreground'
              data-testid='public-appointment-type-link-inactive-duration'
            >
              This appointment type has no appointment length set, so this link
              won&apos;t work yet — set one above to activate it.
            </Text>
          ) : null}
          <HStack gap={2}>
            <Input
              readOnly
              value={url}
              className='font-mono text-sm'
              aria-label='Public scheduling link'
              data-testid='public-appointment-type-link-input'
            />
            <Button
              type='button'
              variant='outline'
              size='icon'
              onClick={() => void handleCopy()}
              aria-label='Copy public scheduling link to clipboard'
              data-testid='copy-public-appointment-type-link-button'
            >
              {copied ? <CheckCheck /> : <Copy />}
            </Button>
          </HStack>
          {copyFailed ? (
            <Text
              size='sm'
              color='destructive'
              data-testid='public-appointment-type-link-copy-failed'
            >
              Copy failed — select the link above and copy it manually.
            </Text>
          ) : null}
        </VStack>
      </CardContent>
    </Card>
  );
}

export interface PublicSchedulingSettingsProps {
  appointmentType: AppointmentType;
}

export function PublicSchedulingSettings({
  appointmentType,
}: PublicSchedulingSettingsProps) {
  // Mirrors the server's admin-only rule for these two fields
  // (`AppointmentTypePermission`) — NOT the owner-or-admin rule
  // `canEditCalendar` / `canMintBookingLinkForAppointmentType` use elsewhere on this
  // page. A member who owns every calendar in the appointment type still cannot flip
  // this toggle; only `organizations.manage_members` can.
  const canManage = useHasPermission(PERMISSIONS.manageMembers);

  const { updatePublicScheduling, updatePublicSchedulingMutation } =
    useUpdateAppointmentTypePublicScheduling(String(appointmentType.id));

  const defaultValues = React.useMemo(
    () => valuesFromAppointmentType(appointmentType),
    [appointmentType]
  );
  // The last values known to match the server, so `onSubmit` can diff
  // against them and omit whichever field didn't actually change — never
  // "resend" a field just because the form still holds a value for it.
  // Plain state rather than a ref: it needs to advance immediately after a
  // successful save (before the invalidated query refetches and `appointment type`
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
  // straight off `appointment type`, not local form state — this warns about the
  // server's current truth, not whatever the admin is mid-editing.
  const isGrandfathered =
    Boolean(appointmentType.accepts_public_scheduling) &&
    appointmentTypeDurationIsUnset(appointmentType.duration);

  const onSubmit = async (values: PublicSchedulingFormValues) => {
    const changes: { accepts_public_scheduling?: boolean; duration?: string } =
      {};
    if (values.enabled !== savedValues.enabled) {
      changes.accepts_public_scheduling = values.enabled;
    }
    if (values.durationMinutes !== savedValues.durationMinutes) {
      changes.duration = minutesToDjangoDuration(values.durationMinutes);
    }
    // Nothing actually changed (e.g. a resubmit with identical values) —
    // an empty PATCH is pointless and would still round-trip through the
    // "omit, don't send null" contract for no reason.
    if (Object.keys(changes).length === 0) {
      return;
    }

    try {
      // The changed field(s) plus the appointment type's current name, description and
      // full slot list — see the header: an appointment type PATCH is only partial for
      // these two fields, and omitting `slots` is a 400.
      await updatePublicScheduling(
        buildAppointmentTypeUpdateBody(appointmentType, changes)
      );
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
    <VStack gap={4}>
      <Card data-testid='public-scheduling-settings'>
        <CardHeader>
          <CardTitle>Public scheduling</CardTitle>
          <CardDescription>
            Let anyone holding this appointment type&apos;s link book an
            appointment without a code.
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
                  This appointment type is public but has no appointment length
                  set — bookings will fail until a length is set below.
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
                            Anyone holding the appointment type&apos;s public
                            link can book without a code.
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
                        Applies to every booking made through this appointment
                        type&apos;s links — there is no per-link duration for an
                        appointment type.
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
      <PublicAppointmentTypeLinkCard appointmentType={appointmentType} />
    </VStack>
  );
}
