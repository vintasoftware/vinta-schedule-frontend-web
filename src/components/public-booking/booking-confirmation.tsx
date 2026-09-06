'use client';

/**
 * BookingConfirmation — terminal success state after a public booking write.
 *
 * Renders the SERVER's `CalendarEvent` response, never the attendee's
 * originally-selected proposal — the same "trust the response, not local
 * state" discipline as `slot-picker.tsx`'s duration rule, applied to the
 * confirmation screen.
 *
 * PHASE 5 — self-service management links:
 *
 * A booking-code create/reschedule `201` now carries a `management` object
 * (`CalendarEventWithManagementCodes`) with a fresh, plaintext, single-use
 * `reschedule_code` / `cancel_code` bound to this event. This component
 * renders both as copyable links, built through `buildBookingLinkUrl` —
 * never hand-assembled — plus a plain statement of when they expire: the
 * backend defaults `expires_at` to the event's own END TIME (reviewed and
 * accepted, not a bug — see the plan's Phase 8 dependency note), so this
 * reads that straight off `event.end_time` rather than inventing separate
 * expiry copy.
 *
 * DEGRADE, NOT CRASH: `extractManagementCodes` reads the ACTUAL response
 * shape with `'management' in event`, never trusting the generated type's
 * `management: BookingManagementCodes` (non-optional) at face value — an
 * older backend's `201` predates Phase 8 entirely and has no `management`
 * key at all. Absent/malformed `management` renders exactly Phase 2's plain
 * confirmation, with no self-service section and no crash.
 *
 * SECURITY — these are live, single-use credentials on a public page:
 *   - Held only in this render's own derived values (`rescheduleUrl`,
 *     `cancelUrl`), never assigned to any other variable, logged, or
 *     persisted to `localStorage` / `sessionStorage`. The plaintext codes
 *     never leave this component except inside the built URLs.
 *   - Every caller (`public-booking-flow.tsx`, `public-group-booking-flow.tsx`,
 *     `reschedule-flow.tsx`) holds the `201` in local component state only
 *     and applies `gcTime: 0` on the mutation that produced it (see
 *     `use-public-book-event.ts`'s doc comment) — this component never reads
 *     from the mutation cache itself, only from the `event` prop it's given.
 *   - This component issues no navigation of its own (no `router.push` /
 *     `router.replace`) — the codes only ever appear inside the rendered
 *     `<Textarea readOnly>` value and the clipboard write a copy click
 *     triggers.
 */

import * as React from 'react';
import { CheckCircle2, Copy, CheckCheck } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Textarea } from 'vinta-schedule-design-system/ui/textarea';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { HStack, VStack, Text } from 'vinta-schedule-design-system/layout';
import type {
  BookingManagementCodes,
  CalendarEvent,
  CalendarEventWithManagementCodes,
} from '@/client';
import { DateTime, zonedFormat } from '@/lib/datetime/index';
import {
  buildBookingLinkUrl,
  type BookingLinkUrlScope,
} from '@/lib/booking-links/build-url';

/**
 * Extract the self-service `management` codes from a booking-code
 * create/reschedule write's `201`, defensively — checked against the
 * ACTUAL response with `'management' in event` plus a shape check on both
 * fields, never trusted from the static type alone. See the module doc
 * comment's "DEGRADE, NOT CRASH" note for why: an older backend's `201`
 * has no `management` key at all despite the generated
 * `CalendarEventWithManagementCodes.management` field being declared
 * non-optional.
 */
export function extractManagementCodes(
  event: CalendarEvent | CalendarEventWithManagementCodes
): BookingManagementCodes | null {
  if (
    'management' in event &&
    event.management != null &&
    typeof event.management.reschedule_code === 'string' &&
    event.management.reschedule_code.length > 0 &&
    typeof event.management.cancel_code === 'string' &&
    event.management.cancel_code.length > 0
  ) {
    return event.management;
  }
  return null;
}

/**
 * The confirmed event's own length in whole seconds, floored at
 * `undefined` for a zero/invalid span. Feeds a calendar-scoped reschedule
 * link's advisory `?duration=` (see `build-url.ts`'s "Single-calendar
 * duration is advisory" guiding decision) — always derived from the
 * SERVER's confirmed `start_time`/`end_time`, never from a caller-requested
 * duration, same "trust the response" discipline as the rest of this
 * component.
 */
function eventDurationSeconds(event: CalendarEvent): number | undefined {
  const start = DateTime.fromISO(event.start_time);
  const end = DateTime.fromISO(event.end_time);
  if (!start.isValid || !end.isValid) return undefined;
  const seconds = end.diff(start, 'seconds').seconds;
  return seconds > 0 ? Math.round(seconds) : undefined;
}

export interface BookingConfirmationProps {
  event: CalendarEvent | CalendarEventWithManagementCodes;
  /** IANA zone to render the confirmed time in — the attendee's chosen zone. */
  timezone: string;
  /**
   * The scope of the flow that produced THIS confirmation — `'calendar'` or
   * `'group'`. Both self-service links this component may render share it:
   * the reschedule link needs it to route to the right of the two
   * un-collapsed reschedule endpoints (`?target=`), and a calendar scope's
   * advisory duration is always recomputed from `event`'s own span (never
   * from `scope.durationSeconds`, which this component ignores). The cancel
   * link ignores `scope` entirely (`buildBookingLinkUrl` does, for a single
   * endpoint covering both scopes) but still needs the param supplied,
   * since the type is shared.
   */
  scope: BookingLinkUrlScope;
  /**
   * Active organization slug, when known — present only on the branded
   * `/o/[slug]/...` routes. The bare `/book/[code]` route has no way to
   * resolve one (no retrieve endpoint for a booking code), so this stays
   * `undefined` there and the built links fall back to the bare route.
   */
  slug?: string;
}

interface ManagementLinkRowProps {
  label: string;
  url: string;
  testId: string;
}

/** One copyable self-service link row — reschedule or cancel. Each instance
 * owns its own "copied" indicator so copying one never affects the other.
 *
 * The `<Textarea readOnly>` — rather than an `<a>` — is deliberate: an
 * anchor click would push the URL (carrying the plaintext code) into
 * browser history, a leak vector for a single-use credential. Read-only +
 * copy is the pattern that keeps the code out of history entirely. A
 * `<Textarea>` rather than a single-line `<Input>` specifically (polish
 * pass): a credential shown exactly once, that the attendee must be able to
 * read before copying, must not truncate — a single-line input clips a URL
 * this long behind its own fixed width with no way to see what's being
 * copied without scrolling inside it. Wrapping across a couple of lines
 * keeps the whole thing legible at once.
 *
 * A fixed `rows` still clips a realistic-length URL once it wraps past that
 * row count (confirmed on the 375px viewport) — the textarea would scroll
 * internally with no affordance that more is hidden, defeating the whole
 * "read it before copying" point. So the height auto-grows to the content:
 * on mount and whenever `url` changes, reset to `auto` (so a shrink is
 * measured correctly) then set the explicit pixel height to `scrollHeight`.
 * `min-h-[60px]` on the `Textarea` atom itself is the floor for a short URL. */
function ManagementLinkRow({ label, url, testId }: ManagementLinkRowProps) {
  const [copied, setCopied] = React.useState(false);
  const [copyFailed, setCopyFailed] = React.useState(false);
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [url]);

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
      // The link is still visible and selectable in the input even if the
      // clipboard write fails — surfaced inline below since this app mounts
      // no `<Toaster/>` and a credential that cannot be re-issued must not
      // fail silently.
      setCopyFailed(true);
    }
  };

  return (
    <VStack gap={1}>
      <Text size='sm' color='muted-foreground'>
        {label}
      </Text>
      <HStack gap={2} align='start'>
        <Textarea
          ref={textareaRef}
          readOnly
          value={url}
          wrap='soft'
          className='resize-none overflow-hidden font-mono text-xs break-all'
          aria-label={`${label} link`}
          data-testid={`${testId}-link-input`}
        />
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='mt-0.5 shrink-0'
          onClick={() => void handleCopy()}
          aria-label={`Copy ${label.toLowerCase()} link to clipboard`}
          data-testid={`copy-${testId}-link-button`}
        >
          {copied ? <CheckCheck /> : <Copy />}
        </Button>
      </HStack>
      {copyFailed ? (
        <Text
          size='sm'
          color='destructive'
          data-testid={`${testId}-copy-failed`}
        >
          Copy failed — select the link above and copy it manually.
        </Text>
      ) : null}
    </VStack>
  );
}

export function BookingConfirmation({
  event,
  timezone,
  scope,
  slug,
}: BookingConfirmationProps) {
  const management = extractManagementCodes(event);

  // The reschedule link always needs the SAME scope as this flow — a
  // group-scoped code must never be routed to the single-calendar
  // reschedule endpoint (see build-url.ts's "no probing" note). A
  // calendar-scoped link's advisory duration is recomputed from the
  // CONFIRMED event's own span, never from `scope.durationSeconds`.
  const calendarDurationSeconds =
    scope.kind === 'calendar' ? eventDurationSeconds(event) : undefined;
  const rescheduleScope: BookingLinkUrlScope =
    scope.kind === 'calendar'
      ? { kind: 'calendar', durationSeconds: calendarDurationSeconds }
      : scope;

  // A calendar-scoped reschedule link with no derivable duration is a link
  // `reschedule-flow.tsx` will refuse to render ("missing a valid
  // duration") — never build/show one in that case; the cancel link (which
  // never needs a duration) is unaffected. A degenerate confirmed span
  // (`end_time <= start_time`) is the only way this happens, and is itself
  // a data anomaly worth hiding the reschedule offer for, not surfacing a
  // link known to be broken.
  const canBuildRescheduleLink =
    scope.kind === 'group' || calendarDurationSeconds !== undefined;

  const rescheduleUrl =
    management && canBuildRescheduleLink
      ? buildBookingLinkUrl({
          code: management.reschedule_code,
          purpose: 'reschedule',
          slug,
          scope: rescheduleScope,
        })
      : null;

  const cancelUrl = management
    ? buildBookingLinkUrl({
        code: management.cancel_code,
        purpose: 'cancel',
        slug,
        // Ignored by buildBookingLinkUrl for `purpose: 'cancel'` — a single
        // endpoint covers both scopes — but the param is still required by
        // the shared type.
        scope,
      })
    : null;

  return (
    <VStack gap={4}>
      <Card data-testid='booking-confirmation'>
        <CardHeader>
          <VStack gap={2} align='center' className='text-center'>
            <Icon icon={CheckCircle2} color='success' size='xl' aria-hidden />
            <CardTitle className='text-2xl'>Booking confirmed</CardTitle>
          </VStack>
        </CardHeader>
        <CardContent>
          <VStack gap={2} align='center' className='text-center'>
            <Text weight='medium'>{event.title}</Text>
            <Text
              size='sm'
              color='muted-foreground'
              data-testid='confirmation-time'
            >
              {zonedFormat(event.start_time, timezone, 'MMM d, yyyy, h:mm a')} –{' '}
              {zonedFormat(event.end_time, timezone, 'h:mm a ZZZZ')}
            </Text>
            <Text size='sm' color='muted-foreground'>
              Save this confirmation for your records.
            </Text>
          </VStack>
        </CardContent>
      </Card>

      {management && cancelUrl ? (
        <Card data-testid='booking-management-links'>
          <CardHeader>
            <CardTitle>Manage your appointment</CardTitle>
          </CardHeader>
          <CardContent>
            <VStack gap={4}>
              <Text size='sm' color='muted-foreground'>
                These links work only once, and only until your appointment ends
                at{' '}
                {zonedFormat(
                  event.end_time,
                  timezone,
                  'MMM d, yyyy, h:mm a ZZZZ'
                )}
                . Save them now — they will not be shown again.
              </Text>
              {rescheduleUrl ? (
                <ManagementLinkRow
                  label='Reschedule'
                  url={rescheduleUrl}
                  testId='reschedule'
                />
              ) : (
                <Text
                  size='sm'
                  color='muted-foreground'
                  data-testid='reschedule-link-unavailable'
                >
                  A reschedule link isn&apos;t available for this appointment.
                  Use the cancel link below, or contact the organizer to
                  reschedule.
                </Text>
              )}
              <ManagementLinkRow
                label='Cancel'
                url={cancelUrl}
                testId='cancel'
              />
            </VStack>
          </CardContent>
        </Card>
      ) : null}
    </VStack>
  );
}
