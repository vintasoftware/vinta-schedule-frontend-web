/**
 * useEditOccurrence — edit a calendar event (single occurrence exception or non-recurring).
 *
 * Scope → operation mapping:
 *
 *   Non-recurring event (or scope = 'all' on a recurring series):
 *     calendarEventsPartialUpdate(id, { title?, description?, start_time?, end_time?, timezone? })
 *     → PATCH /calendar-events/{id}/
 *     Updates the event's fields in place. Only the provided fields are sent.
 *
 *   Recurring event, scope = 'this':
 *     calendarEventsCreateExceptionCreate(id, {
 *       exception_date,
 *       modified_title?,
 *       modified_description?,
 *       modified_start_time?,
 *       modified_end_time?,
 *       is_cancelled: false (omitted),
 *     })
 *     → POST /calendar-events/{id}/create-exception/
 *     Creates a single-occurrence modification exception. The exception_date is
 *     the ISO date portion (YYYY-MM-DD) of the occurrence's start_time. Only the
 *     explicitly provided fields are sent; is_cancelled is omitted (falsy) to
 *     signal this is a modification, not a cancellation.
 *
 *   Recurring event, scope = 'following':
 *     calendarEventsBulkModifyCreate(id, {
 *       modification_start_date,
 *       modified_title?,
 *       modified_description?,
 *       modified_start_time_offset?,
 *       modified_end_time_offset?,
 *     })
 *     → POST /calendar-events/{id}/bulk-modify/
 *     Modifies this occurrence and all future ones.
 *     NOTE: This scope is wired for Phase 23 — the caller in EditEventDialog
 *     routes 'following' here. Currently supports title/description and time
 *     offsets (HH:MM:SS from midnight, same timezone as the series).
 *
 *   Recurring event, scope = 'all':
 *     calendarEventsPartialUpdate(id, { title?, description?, start_time?, end_time? })
 *     → PATCH /calendar-events/{id}/
 *     Updates the whole series. NOTE: This scope path will be owned by Phase 24
 *     once that is merged; the callers route 'all' here and it works correctly
 *     since PATCH on the series root applies to all occurrences.
 *
 * Cache invalidation:
 *   On success: invalidateCalendarEvents(queryClient) — refreshes all calendar views.
 */

import { useQueryClient } from '@tanstack/react-query';
import {
  calendarEventsPartialUpdate,
  calendarEventsCreateExceptionCreate,
  calendarEventsBulkModifyCreate,
} from '@/client/sdk.gen';
import { invalidateCalendarEvents } from '@/hooks/events/use-calendar-events';
import type { CalendarEventVM } from '@/components/calendar/event-vm';
import type { RecurringScope } from '@/components/bookings/scope-prompt-dialog';
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The set of editable fields for an event (all optional — only provided fields
 * are sent to the API).
 */
export interface EventChanges {
  title?: string;
  description?: string;
  /** ISO datetime string with offset, e.g. "2024-06-15T09:00:00-04:00". */
  startTime?: string;
  /** ISO datetime string with offset. */
  endTime?: string;
  /** IANA timezone name, e.g. "America/New_York". */
  timezone?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Luxon DateTime to an "HH:MM:SS" time-of-day offset string suitable
 * for the `modified_start_time_offset` / `modified_end_time_offset` fields in
 * the bulk-modify API body.
 *
 * The backend interprets this as a Python `timedelta` from midnight (00:00:00),
 * representing the new time of day for the modified occurrences.
 */
function toTimeOffset(dt: DateTime): string {
  const h = String(dt.hour).padStart(2, '0');
  const m = String(dt.minute).padStart(2, '0');
  const s = String(dt.second).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// ---------------------------------------------------------------------------
// useEditOccurrence
// ---------------------------------------------------------------------------

/**
 * useEditOccurrence — edit a calendar event with scope control.
 *
 * The default export provides the full `editOccurrence` function with all scopes.
 * See the named export `useEditThisAndFollowing` for Phase 23's split-series scope.
 */
export function useEditOccurrence() {
  const queryClient = useQueryClient();

  /**
   * Edit the given event with the provided changes.
   *
   * @param event    The CalendarEventVM to edit (must have `_raw.id`).
   * @param changes  The fields to change (all optional — only provided are sent).
   * @param scope    Required when `event.isRecurring` is true. Ignored for
   *                 non-recurring events. Defaults to 'this' for safety when
   *                 accidentally omitted on a recurring event (safest — only
   *                 affects this occurrence rather than the whole series).
   */
  const editOccurrence = async (
    event: CalendarEventVM,
    changes: EventChanges,
    scope?: RecurringScope
  ): Promise<void> => {
    const id = String(event._raw.id);

    if (!event.isRecurring) {
      // Non-recurring: PATCH the event directly with the changed fields.
      await calendarEventsPartialUpdate({
        path: { id },
        body: {
          ...(changes.title !== undefined && { title: changes.title }),
          ...(changes.description !== undefined && {
            description: changes.description,
          }),
          ...(changes.startTime !== undefined && {
            start_time: changes.startTime,
          }),
          ...(changes.endTime !== undefined && { end_time: changes.endTime }),
          ...(changes.timezone !== undefined && { timezone: changes.timezone }),
        },
      });
    } else {
      // Recurring: apply the chosen scope.
      const resolvedScope: RecurringScope = scope ?? 'this';

      switch (resolvedScope) {
        case 'this': {
          // Edit only this occurrence via a modification exception.
          // exception_date: ISO date (YYYY-MM-DD) of the original occurrence's
          // start_time — matches the API's recurrence_id format.
          const exceptionDate = event._raw.start_time.slice(0, 10);
          await calendarEventsCreateExceptionCreate({
            path: { id },
            body: {
              exception_date: exceptionDate,
              ...(changes.title !== undefined && {
                modified_title: changes.title,
              }),
              ...(changes.description !== undefined && {
                modified_description: changes.description,
              }),
              ...(changes.startTime !== undefined && {
                modified_start_time: changes.startTime,
              }),
              ...(changes.endTime !== undefined && {
                modified_end_time: changes.endTime,
              }),
              // is_cancelled is intentionally omitted (falsy) — this is a
              // modification, not a cancellation.
            },
          });
          break;
        }

        case 'following': {
          // Edit this occurrence and all future ones via bulk-modify.
          // modification_start_date: ISO date of this occurrence's start.
          // Time fields are sent as "HH:MM:SS" offsets from midnight.
          // NOTE: Phase 23 will own this scope — wired here for completeness.
          const modificationStartDate = event._raw.start_time.slice(0, 10);
          const tz = changes.timezone ?? event.timezone;
          const startOffset =
            changes.startTime !== undefined
              ? toTimeOffset(DateTime.fromISO(changes.startTime, { zone: tz }))
              : undefined;
          const endOffset =
            changes.endTime !== undefined
              ? toTimeOffset(DateTime.fromISO(changes.endTime, { zone: tz }))
              : undefined;
          await calendarEventsBulkModifyCreate({
            path: { id },
            body: {
              modification_start_date: modificationStartDate,
              ...(changes.title !== undefined && {
                modified_title: changes.title,
              }),
              ...(changes.description !== undefined && {
                modified_description: changes.description,
              }),
              ...(startOffset !== undefined && {
                modified_start_time_offset: startOffset,
              }),
              ...(endOffset !== undefined && {
                modified_end_time_offset: endOffset,
              }),
            },
          });
          break;
        }

        case 'all': {
          // Edit the whole series by PATCHing the parent event.
          // NOTE: Phase 24 will own this scope — wired here for completeness.
          await calendarEventsPartialUpdate({
            path: { id },
            body: {
              ...(changes.title !== undefined && { title: changes.title }),
              ...(changes.description !== undefined && {
                description: changes.description,
              }),
              ...(changes.startTime !== undefined && {
                start_time: changes.startTime,
              }),
              ...(changes.endTime !== undefined && {
                end_time: changes.endTime,
              }),
              ...(changes.timezone !== undefined && {
                timezone: changes.timezone,
              }),
            },
          });
          break;
        }
      }
    }

    // Invalidate all calendar events queries so all views refresh.
    await invalidateCalendarEvents(queryClient);
  };

  return { editOccurrence };
}

/**
 * useEditThisAndFollowing — Phase 23 named wrapper for scope='following'.
 *
 * Splits a recurring event series at a chosen occurrence:
 * - Occurrences before the chosen one remain unchanged.
 * - The chosen occurrence and all later ones are modified.
 *
 * This is implemented via `calendarEventsBulkModifyCreate`, which uses
 * `modification_start_date` (the occurrence's date) as the split point.
 *
 * Example:
 *   Series: Mon, Tue, Wed, Thu, Fri (recurring weekly)
 *   Editing Wed with changes { title: "Updated" }
 *   → Result: Mon, Tue unchanged; Wed, Thu, Fri become "Updated"
 *
 * @param event   The calendar event occurrence to edit (must have `_raw.id`).
 * @param changes The fields to modify (title, description, start/end times).
 * @returns Promise that resolves when the modification completes.
 */
export function useEditThisAndFollowing() {
  const { editOccurrence } = useEditOccurrence();

  const editThisAndFollowing = async (
    event: CalendarEventVM,
    changes: EventChanges
  ): Promise<void> => {
    return editOccurrence(event, changes, 'following');
  };

  return { editThisAndFollowing };
}

/**
 * useEditWholeSeries — Phase 24 named wrapper for scope='all'.
 *
 * Edits the entire recurring event series, applying changes to every occurrence.
 *
 * This is implemented via `calendarEventsPartialUpdate` on the series root,
 * which modifies the recurrence-rule event itself. All occurrences (past,
 * present, and future) reflect the change.
 *
 * Example:
 *   Series: Mon, Tue, Wed, Thu, Fri (recurring weekly)
 *   Editing with changes { title: "Updated" }
 *   → Result: ALL occurrences become "Updated"
 *
 * @param event   The calendar event (may be a single occurrence or the series itself).
 * @param changes The fields to modify (title, description, start/end times).
 * @returns Promise that resolves when the modification completes.
 */
export function useEditWholeSeries() {
  const { editOccurrence } = useEditOccurrence();

  const editWholeSeries = async (
    event: CalendarEventVM,
    changes: EventChanges
  ): Promise<void> => {
    return editOccurrence(event, changes, 'all');
  };

  return { editWholeSeries };
}
