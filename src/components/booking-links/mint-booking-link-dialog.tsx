'use client';

/**
 * MintBookingLinkDialog — mint a shareable scheduling link for a calendar or
 * appointment type, show it exactly once, and offer to revoke it.
 *
 * Two-phase dialog, mirroring `NewTokenDialog`
 * (@/components/api-tokens/new-token-dialog.tsx), the repo's other one-time
 * plaintext-credential mint flow:
 *   Phase 1 (form view): optional expiry, and — for a calendar target only —
 *     an advisory duration. An appointment type target shows no duration control; the
 *     appointment type's own server-pinned duration applies instead (see the plan's
 *     "Appointment Type duration comes from the server" guiding decision).
 *   Phase 2 (reveal view): the built URL, a copy button, an explicit
 *     "cannot be shown again" notice, and a revoke action — all while the
 *     dialog still holds the minted id. A third state (revoked) replaces the
 *     URL with a plain "this link no longer works" notice once revoke
 *     succeeds.
 *
 * An appointment type target with no pinned `duration` never reaches the form at all —
 * `appointmentTypeDurationIsUnset` (`@/lib/booking-links/duration-format`, the shared
 * two-way duration<->minutes converter Phase 6 built for the appointment type settings
 * form) blocks it with an explanation instead, since the appointment-type-scoped
 * bookable-slots read would otherwise silently hand every attendee a
 * frontend-chosen placeholder length nobody with authority picked
 * (SHOULD-FIX 1, Phase 3 review).
 *
 * SECURITY invariants (this is the phase's single most important file):
 *   - The plaintext `code` returned by `createBookingCode` is used ONLY to
 *     build `mintedLink.url` (via `buildBookingLinkUrl`) in local component
 *     state. It is never assigned to any other variable, never logged, never
 *     written to `localStorage` / `sessionStorage`, and never survives past
 *     this dialog closing.
 *   - `createBookingCodeMutation.data` would otherwise retain the full
 *     `BookingCodeCreateResult` (including plaintext `code`) in TanStack
 *     Query's mutation cache after this component's local state is cleared.
 *     `useCreateBookingCode` sets `gcTime: 0` (see its doc comment) so the
 *     mutation is garbage-collected as soon as the last observer detaches,
 *     rather than lingering for the app's default 5-minute mutation
 *     `gcTime`. The close/unmount effects below additionally call `.reset()`
 *     on both mutations — belt-and-suspenders with `gcTime: 0`, and it also
 *     clears local `isPending`/`isError`/`data` state on `open === false`
 *     re-renders — exactly as `NewTokenDialog` does for its credential.
 *   - Minting is a UI affordance gated by `canMintBookingLinkForCalendar` /
 *     `canMintBookingLinkForAppointmentType` at the call site (the row action), never
 *     re-derived here — this component trusts its caller decided it should
 *     be reachable, and the server re-checks the real rule regardless.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Copy, CheckCheck, TriangleAlert, Ban } from 'lucide-react';
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
import { Alert, AlertDescription } from 'vinta-schedule-design-system/ui/alert';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import {
  VStack,
  HStack,
  Text,
  FormLayout,
} from 'vinta-schedule-design-system/layout';
import type { BookingCodeCreate } from '@/client';
import { useCreateBookingCode } from '@/hooks/booking-codes/use-create-booking-code';
import { useRevokeBookingCode } from '@/hooks/booking-codes/use-revoke-booking-code';
import { useCurrentOrganization } from '@/hooks/organizations/use-current-organization';
import {
  buildBookingLinkUrl,
  type BookingLinkUrlScope,
} from '@/lib/booking-links/build-url';
import type { MintedBookingLink } from '@/lib/booking-links/types';
import { appointmentTypeDurationIsUnset } from '@/lib/booking-links/duration-format';
import { handleMutationError } from '@/lib/utils/form-errors';
// Reused rather than re-implemented: the {value, unit} number+select field and
// its "0 means unconstrained" convention already exist for booking-policy rule
// fields, and a single-calendar link's duration is advisory in exactly the
// same "0 = don't send a constraint" sense (see the plan's "Single-calendar
// duration is advisory" guiding decision).
import {
  DurationFormField,
  durationFieldSchema,
  ZERO_DURATION,
} from '@/components/booking-policies/rule-fields';
import {
  durationToSeconds,
  secondsToDuration,
  type DurationValue,
} from '@/components/booking-policies/duration';

export type MintBookingLinkTarget =
  | { kind: 'calendar'; id: number; name: string }
  | {
      kind: 'appointmentType';
      id: number;
      name: string;
      /**
       * `AppointmentType.duration` verbatim off the wire — a Django
       * `DurationField` string (`[DD] [HH:[MM:]]ss[.uuuuuu]`), NOT seconds
       * (see the plan's "`AppointmentType.duration` is a string on the wire"
       * guiding decision). Absent/empty/all-zero means the appointment type has no
       * pinned length yet, which `appointmentTypeDurationIsUnset`
       * (`@/lib/booking-links/duration-format`) checks for below. This
       * field is read-only here and never round-tripped — the editor lives
       * in `public-scheduling-settings.tsx`.
       */
      duration?: string;
    }
  | {
      kind: 'event';
      /** The event id — `BookingCodeCreate.event`. */
      id: number;
      /** Display label for the dialog copy — usually the event's title. */
      name: string;
      purpose: 'reschedule' | 'cancel';
      /**
       * Which reschedule endpoint a reschedule link must route to — the
       * EVENT's own scope (single-calendar vs. appointment-type), not
       * something the member picks. Irrelevant for `purpose: 'cancel'`
       * (`publicBookingEventsCancelCreate` is a single endpoint for both —
       * see the plan's Phase 4 body, point 4), but always supplied so
       * callers need only one target shape.
       *
       * A calendar-scoped reschedule needs an advisory `durationSeconds`
       * for the same reason a fresh calendar `book` link does — the
       * calendar-bookable-slots read's `duration_seconds` param is always
       * required. Callers should pass the EVENT's own current length
       * (`end_time - start_time`), not an arbitrary default; it remains
       * editable here, same as a `book` link's advisory duration.
       *
       * An appointment-type-scoped reschedule carries no per-link duration at all,
       * mirroring "Appointment Type duration comes from the server" for `book` links.
       * UNLIKE the plain `appointment type` target above, this dialog does NOT block
       * minting on an unset appointment type duration for this case: the events
       * surface has no reliable way to read the parent appointment type's CURRENT
       * `duration` off an already-created event
       * (`CalendarEventAppointmentTypeSelection` carries a slot and a calendar, never
       * the appointment type entity itself), so there is nothing here to check. This
       * is an accepted, documented gap — see the phase report, not an
       * oversight — and the reschedule page behaves exactly like an
       * unset-duration appointment type `book` link already does (Phase 3).
       */
      eventScope:
        | { kind: 'calendar'; durationSeconds: number }
        | { kind: 'appointmentType' };
    };

export interface MintBookingLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: MintBookingLinkTarget;
}

// ---------------------------------------------------------------------------
// Zod schema — expiry is a plain <input type="datetime-local"> value (or ''
// for "never expires"); duration is only read for a calendar target.
// ---------------------------------------------------------------------------

const mintFormBaseSchema = z.object({
  expiresAt: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Date.parse(value)), {
      message: 'Enter a valid date and time',
    })
    .refine((value) => value === '' || Date.parse(value) > Date.now(), {
      message: 'Expiration must be in the future',
    }),
  duration: durationFieldSchema,
});

type MintFormValues = z.infer<typeof mintFormBaseSchema>;

/**
 * True when this target's form should show (and require a non-zero)
 * duration control: a `calendar` `book` target always does; a
 * calendar-scoped `event` `reschedule` target does for the same reason
 * (the calendar-bookable-slots read's `duration_seconds` param is always
 * required); every other target (`appointment type`, or an `event` `cancel` /
 * appointment-type-scoped `reschedule`) does not.
 */
function needsDurationControl(target: MintBookingLinkTarget): boolean {
  if (target.kind === 'calendar') return true;
  if (target.kind === 'event') {
    return (
      target.purpose === 'reschedule' && target.eventScope.kind === 'calendar'
    );
  }
  return false;
}

// A calendar-scoped link's `?duration=` is the only length the public
// booking read (`PublicBookingCalendarBookableSlotsListData.query.duration_seconds`)
// will ever see — that read documents the param as ALWAYS REQUIRED, with no
// "unconstrained" mode. The shared rule-fields "0 = unconstrained" convention
// (used for booking-policy guardrails) does not apply here: a calendar-scoped
// link minted with a zero duration builds a URL with no `?duration=`, and
// the public flow correctly refuses to invent one, so every recipient sees a
// permanently broken "missing a valid duration" link. Appointment Type targets (and
// `cancel` links) are unaffected — they have no duration control.
function buildMintFormSchema(target: MintBookingLinkTarget) {
  return mintFormBaseSchema.refine(
    (values) =>
      !needsDurationControl(target) || durationToSeconds(values.duration) > 0,
    {
      message:
        'Set a duration greater than zero — the public booking page requires a fixed length for a calendar link.',
      path: ['duration'],
    }
  );
}

// A calendar `book` target defaults to a working, non-zero length (30
// minutes) so generating a link without touching the duration control still
// produces a usable link, rather than defaulting to the now-blocked zero.
// Targets with no duration control keep the neutral `ZERO_DURATION` default
// — the value is never sent (see `onSubmit`).
const DEFAULT_CALENDAR_DURATION: DurationValue = { value: 30, unit: 'minutes' };

function defaultValuesForTarget(target: MintBookingLinkTarget): MintFormValues {
  if (target.kind === 'calendar') {
    return { expiresAt: '', duration: { ...DEFAULT_CALENDAR_DURATION } };
  }
  if (
    target.kind === 'event' &&
    target.purpose === 'reschedule' &&
    target.eventScope.kind === 'calendar'
  ) {
    // Default to the EVENT's own current length — the most sensible
    // advisory starting point for "reschedule to a new time of about this
    // length". Still editable, same as a fresh calendar `book` link.
    return {
      expiresAt: '',
      duration: secondsToDuration(target.eventScope.durationSeconds),
    };
  }
  return { expiresAt: '', duration: { ...ZERO_DURATION } };
}

export function MintBookingLinkDialog({
  open,
  onOpenChange,
  target,
}: MintBookingLinkDialogProps) {
  const { createBookingCode, createBookingCodeMutation } =
    useCreateBookingCode();
  const { revokeBookingCode, revokeBookingCodeMutation } =
    useRevokeBookingCode();
  // Used only to resolve the active org's slug for the branded URL
  // (`buildBookingLinkUrl`'s `slug` param) — never sent to the mint call
  // itself, which is org-scoped by the shared authenticated client already.
  const { organization } = useCurrentOrganization();
  const rawSlug = organization?.slug;
  const slug = typeof rawSlug === 'string' ? rawSlug : undefined;

  // `target` is fixed for the lifetime of one dialog instance (the calling
  // tables mount/unmount this dialog per target rather than re-targeting it
  // in place), but the schema and defaults are still computed from it via
  // `useMemo` rather than as a module-level constant, since both branch on
  // the target's kind/purpose/scope.
  const mintFormSchema = React.useMemo(
    () => buildMintFormSchema(target),
    [target]
  );
  const defaultValues = React.useMemo(
    () => defaultValuesForTarget(target),
    [target]
  );

  const form = useForm<MintFormValues>({
    resolver: zodResolver(mintFormSchema),
    defaultValues,
  });

  // ---------------------------------------------------------------------------
  // SECURITY: one-time plaintext link — local state only. Cleared on close.
  // Never logged. Never cached beyond this component. Never persisted.
  // ---------------------------------------------------------------------------
  const [mintedLink, setMintedLink] = React.useState<MintedBookingLink | null>(
    null
  );
  const [isRevoked, setIsRevoked] = React.useState(false);
  // Set only when a revoke attempt fails, so the dialog can say so inline —
  // without this the link would fail to revoke silently (toast-only, and
  // this app mounts no `<Toaster />`) and a member could reasonably believe
  // a still-live link was dead.
  const [revokeError, setRevokeError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  // Holds the "copied" reset timer so it can be cancelled instead of firing
  // a `setState` after the component (or the copy indicator) is gone.
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Reset all local + mutation state when the dialog closes. See the
  // file-level SECURITY comment for why both mutations are explicitly
  // `.reset()` — `.reset` (not the mutation object) is the effect dependency
  // because it keeps a stable identity across renders, unlike the mutation
  // object itself (see NewTokenDialog for the identical reasoning and the
  // re-render-loop regression it guards against).
  const resetCreateMutation = createBookingCodeMutation.reset;
  const resetRevokeMutation = revokeBookingCodeMutation.reset;
  React.useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      setMintedLink(null);
      setIsRevoked(false);
      setRevokeError(null);
      setCopied(false);
      resetCreateMutation();
      resetRevokeMutation();
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    }
  }, [open, form, defaultValues, resetCreateMutation, resetRevokeMutation]);

  // Unmount cleanup: `calendars-table.tsx` and `appointment-types-table.tsx` mount this
  // dialog conditionally (`{mintTarget && <MintBookingLinkDialog .../>}`), so
  // `onOpenChange(false)` unmounts the component before it ever re-renders
  // with `open === false` — the effect above never runs at those call sites.
  // This guarantees the mutation-reset guarantee holds regardless of how a
  // caller mounts the dialog.
  React.useEffect(
    () => () => {
      resetCreateMutation();
      resetRevokeMutation();
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current);
      }
    },
    [resetCreateMutation, resetRevokeMutation]
  );

  const isPending = createBookingCodeMutation.isPending;
  const isRevokePending = revokeBookingCodeMutation.isPending;
  const isRevealView = mintedLink !== null;

  const targetLabel =
    target.kind === 'calendar' ? 'calendar' : 'appointmentType';
  const needsDuration = needsDurationControl(target);

  // Refuse to mint at the source (SHOULD-FIX 1, Phase 3 review): an appointment type
  // with no pinned duration would otherwise silently hand every attendee
  // the appointment-type-slots read's placeholder length. Blocked before the form even
  // renders, not surfaced as a validation error on submit — there is no
  // valid input the member could supply here to fix it; the appointment type itself
  // needs a duration first.
  const isBlockedAppointmentType =
    target.kind === 'appointmentType' &&
    appointmentTypeDurationIsUnset(target.duration);

  const onSubmit = async (values: MintFormValues) => {
    const expiresAt =
      values.expiresAt !== ''
        ? new Date(values.expiresAt).toISOString()
        : undefined;

    let body: BookingCodeCreate;
    let scope: BookingLinkUrlScope;
    // Only set for a calendar-scoped duration control (calendar `book`, or
    // an event-scoped calendar `reschedule`) — `null` means "no advisory
    // duration to echo back into `mintedLink`".
    let mintedDurationSeconds: number | null = null;

    if (target.kind === 'calendar') {
      const durationSeconds = durationToSeconds(values.duration);
      body = { purpose: 'book', calendar: target.id, expires_at: expiresAt };
      scope = {
        kind: 'calendar',
        durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
      };
      mintedDurationSeconds = durationSeconds > 0 ? durationSeconds : null;
    } else if (target.kind === 'appointmentType') {
      body = {
        purpose: 'book',
        appointment_type: target.id,
        expires_at: expiresAt,
      };
      scope = { kind: 'appointmentType' };
    } else {
      // Event-scoped reschedule/cancel: `event` is the only association the
      // mint body needs — calendar/appointment type is inferred server-side from the
      // event itself (`BookingCodeCreate` has no separate field for it).
      body = {
        purpose: target.purpose,
        event: target.id,
        expires_at: expiresAt,
      };

      if (
        target.purpose === 'reschedule' &&
        target.eventScope.kind === 'calendar'
      ) {
        const durationSeconds = durationToSeconds(values.duration);
        scope = {
          kind: 'calendar',
          durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
        };
        mintedDurationSeconds = durationSeconds > 0 ? durationSeconds : null;
      } else if (target.purpose === 'reschedule') {
        scope = { kind: 'appointmentType' };
      } else {
        // `cancel` writes no `?target=`/`?duration=` at all —
        // `buildBookingLinkUrl` ignores `scope` for this purpose. A bare
        // calendar scope is the simplest value satisfying the type; it is
        // never read.
        scope = { kind: 'calendar' };
      }
    }

    try {
      const result = await createBookingCode(body);
      const url = buildBookingLinkUrl({
        code: result.code,
        purpose: result.purpose,
        slug,
        scope,
      });
      // The ONLY place `result.code` is read. From here on, only `url`
      // (which embeds it) is retained, in local state that is cleared on
      // close.
      setMintedLink({
        id: result.id,
        purpose: result.purpose,
        url,
        expiresAt: result.expires_at,
        durationSeconds: mintedDurationSeconds,
      });
    } catch (err) {
      // `handleMutationError` only places a message on the form when the
      // rejection is field-shaped (`non_field_errors` / per-field). A bare
      // `{"detail": "..."}` body — DRF's default `PermissionDenied` shape,
      // the most likely response to the server's owner-or-org-admin check —
      // falls through to `toast.error` instead, and this app mounts no
      // `<Toaster />`, so that toast would render nothing. Forcing the
      // returned description onto the form root guarantees every mint
      // failure shape ends up visible inline in this dialog.
      const description = handleMutationError(err, {
        title: 'Failed to generate link',
        form,
      });
      if (description) {
        form.setError('root', { message: description });
      }
    }
  };

  const handleCopy = async () => {
    if (!mintedLink) return;
    try {
      await navigator.clipboard.writeText(mintedLink.url);
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link to clipboard.');
    }
  };

  const handleRevoke = async () => {
    if (!mintedLink) return;
    setRevokeError(null);
    try {
      await revokeBookingCode(mintedLink.id);
      setIsRevoked(true);
      toast.success('Link revoked', {
        description: 'The link no longer works for anyone holding it.',
      });
    } catch (err) {
      // No `form` here — the reveal view has no form, only the `Alert` this
      // dialog already renders for the revoked state. `handleMutationError`
      // always falls through to `toast.error` in this no-`form` case, and
      // this app mounts no `<Toaster />`, so relying on the toast alone
      // would leave a failed revoke completely invisible: the member could
      // walk away believing a still-live link was dead. Capture the
      // description and show it inline instead, without flipping
      // `isRevoked` — the link must never be presented as revoked when it
      // isn't.
      const description = handleMutationError(err, {
        title: 'Failed to revoke link',
      });
      setRevokeError(description);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {isBlockedAppointmentType ? (
          <>
            <DialogHeader>
              <DialogTitle>
                This appointmentType can&apos;t take public bookings yet
              </DialogTitle>
              <DialogDescription>
                <Text as='span' weight='medium'>
                  {target.name}
                </Text>{' '}
                has no appointment length set.
              </DialogDescription>
            </DialogHeader>
            <Alert
              variant='warning'
              data-testid='appointment-type-duration-required-notice'
            >
              <Icon icon={TriangleAlert} size='sm' />
              <AlertDescription>
                The appointmentType needs a duration before it can take public
                bookings — set one on the appointment type&apos;s settings, then
                generate the link.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button type='button' onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : isRevealView ? (
          <>
            <DialogHeader>
              <DialogTitle>Scheduling link created</DialogTitle>
              <DialogDescription>
                {isRevoked
                  ? 'This link has been revoked and no longer works.'
                  : 'This is the only time this link is shown. Copy it now.'}
              </DialogDescription>
            </DialogHeader>

            <VStack gap={4}>
              {isRevoked ? (
                <Alert variant='destructive' data-testid='revoked-notice'>
                  <Icon icon={Ban} size='sm' />
                  <AlertDescription>
                    This link has been revoked. It no longer works for anyone
                    holding it.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant='warning' data-testid='one-time-reveal-notice'>
                  <Icon icon={TriangleAlert} size='sm' />
                  <AlertDescription>
                    Copy this link now — it cannot be shown again once this
                    dialog closes.
                  </AlertDescription>
                </Alert>
              )}
              {revokeError && !isRevoked ? (
                <Alert variant='destructive' data-testid='revoke-failed-notice'>
                  <Icon icon={TriangleAlert} size='sm' />
                  <AlertDescription>
                    Failed to revoke this link — it is still active and working
                    for anyone holding it. {revokeError}
                  </AlertDescription>
                </Alert>
              ) : null}

              <VStack gap={1}>
                <Text size='sm' color='muted-foreground'>
                  Scheduling link
                </Text>
                <HStack gap={2}>
                  <Input
                    readOnly
                    disabled={isRevoked}
                    value={mintedLink.url}
                    className='font-mono text-sm'
                    data-testid='booking-link-url-input'
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    disabled={isRevoked}
                    onClick={handleCopy}
                    aria-label='Copy scheduling link to clipboard'
                    data-testid='copy-booking-link-button'
                  >
                    {copied ? <CheckCheck /> : <Copy />}
                  </Button>
                </HStack>
                {mintedLink.expiresAt ? (
                  <Text size='sm' color='muted-foreground'>
                    Expires {new Date(mintedLink.expiresAt).toLocaleString()}
                  </Text>
                ) : (
                  <Text size='sm' color='muted-foreground'>
                    This link does not expire.
                  </Text>
                )}
              </VStack>
            </VStack>

            <DialogFooter>
              {!isRevoked && (
                <Button
                  type='button'
                  variant='outline'
                  onClick={handleRevoke}
                  disabled={isRevokePending}
                  className='text-destructive hover:text-destructive'
                  data-testid='revoke-booking-link-button'
                >
                  {isRevokePending ? 'Revoking…' : 'Revoke link'}
                </Button>
              )}
              <Button
                type='button'
                onClick={handleClose}
                data-testid='done-button'
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {target.kind === 'event'
                  ? target.purpose === 'reschedule'
                    ? 'New reschedule link'
                    : 'New cancel link'
                  : 'New scheduling link'}
              </DialogTitle>
              <DialogDescription>
                {target.kind === 'event' ? (
                  <>
                    Generate a link that lets the attendee{' '}
                    {target.purpose === 'reschedule' ? 'reschedule' : 'cancel'}{' '}
                    <Text as='span' weight='medium'>
                      {target.name}
                    </Text>
                    . The link can be copied and revoked once, but never shown
                    again after this dialog closes.
                  </>
                ) : (
                  <>
                    Generate a shareable booking link for the {targetLabel}{' '}
                    <Text as='span' weight='medium'>
                      {target.name}
                    </Text>
                    . The link can be copied and revoked once, but never shown
                    again after this dialog closes.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <FormRootMessage />
              <FormLayout
                onSubmit={form.handleSubmit(onSubmit)}
                gap={4}
                noValidate
              >
                <FormField
                  control={form.control}
                  name='expiresAt'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expires (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type='datetime-local'
                          {...field}
                          data-testid='expires-at-input'
                        />
                      </FormControl>
                      <FormDescription>
                        Leave blank for a link with no expiration.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {needsDuration ? (
                  <FormField
                    control={form.control}
                    name='duration'
                    render={({ field }) => (
                      <DurationFormField
                        field={field}
                        label='Booking duration'
                        description='Advisory only — anyone holding the link can change it in the URL, but a value is required so the public booking page has a length to request. To enforce a duration server-side, wrap this calendar in a one-slot appointment type and set the appointment type duration instead.'
                      />
                    )}
                  />
                ) : target.kind === 'appointmentType' ? (
                  <Text size='sm' color='muted-foreground'>
                    This appointment type&apos;s own duration applies to every
                    booking made through this link — there is no per-link
                    duration for an appointmentType target.
                  </Text>
                ) : target.kind === 'event' &&
                  target.purpose === 'reschedule' ? (
                  <Text size='sm' color='muted-foreground'>
                    This appointment&apos;s appointment type has its own
                    server-pinned duration — there is no per-link duration for
                    an appointment-type-scoped reschedule.
                  </Text>
                ) : null}

                <DialogFooter>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={handleClose}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type='submit'
                    disabled={isPending}
                    data-testid='create-booking-link-submit'
                  >
                    {isPending ? 'Generating…' : 'Generate link'}
                  </Button>
                </DialogFooter>
              </FormLayout>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
