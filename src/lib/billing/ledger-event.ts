/**
 * The project's own shape for a ledger row's `event`.
 *
 * `vinta-django-billing` 0.6.0 stopped declaring `title` / `calendar` /
 * `owners` on `LedgerEvent`. That was not a payload change — those fields are
 * still sent. The package simply stopped claiming to own their shape: the
 * serializer now passes through whatever this project's configured
 * `OccurrenceSource.describe` returns, so the generated `LedgerEvent` narrowed
 * to the one field the package does guarantee (`id`) and left the rest as
 * undeclared extra keys.
 *
 * The shape below is what this project's source
 * (`payments.seams.occurrences.CalendarEventOccurrenceSource.describe`)
 * actually returns. It lives here, in the project, because that is where the
 * contract now lives on the backend too.
 *
 * `normalizeLedgerEvent` is what the components consume. It exists rather than
 * a bare cast because the generated type no longer guarantees these fields:
 * were `describe` to change shape, a cast would hand the UI an `owners` of
 * `undefined` and crash the row on `.map`. Normalizing instead degrades a
 * missing field to the same empty state a genuinely-absent one already renders
 * ("—"), which is the behavior the ledger already promises for a row whose
 * event it cannot fully resolve.
 */

import type { LedgerEvent } from '@/client';

/** One owner of the ledger event's calendar (a `CalendarOwnership`). */
export interface LedgerEventOwner {
  user_id: number;
  name: string;
}

/** The calendar a ledger event lives on. */
export interface LedgerEventCalendar {
  id: number;
  name: string;
}

/**
 * A ledger event as this project actually sends it: the package's guaranteed
 * `id` plus the extra keys `CalendarEventOccurrenceSource.describe` attaches.
 *
 * Every added field is optional, because the generated `LedgerEvent` no longer
 * declares any of them — nothing in the type system stops the backend source
 * from changing shape. Read a value of this type through
 * `normalizeLedgerEvent` rather than reaching into it directly; it is here to
 * describe and construct the payload (fixtures, stories, anything asserting on
 * the wire shape), not to be rendered from.
 */
export type CalendarLedgerEvent = LedgerEvent & {
  title?: string | null;
  calendar?: LedgerEventCalendar | null;
  owners?: LedgerEventOwner[];
};

/**
 * A ledger event with every project-specific field resolved to a total type —
 * no optionals, so callers never re-check what the normalizer already handled.
 *
 * `title` is the SERIES ROOT's title, not the individual occurrence's; the
 * ledger surfaces that caveat in the UI (see `SERIES_ROOT_TITLE_CAVEAT`).
 */
export interface NormalizedLedgerEvent {
  id: number;
  title: string | null;
  calendar: LedgerEventCalendar | null;
  owners: LedgerEventOwner[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readCalendar(value: unknown): LedgerEventCalendar | null {
  if (!isRecord(value)) return null;
  const { id, name } = value;
  if (typeof id !== 'number' || typeof name !== 'string') return null;
  return { id, name };
}

function readOwners(value: unknown): LedgerEventOwner[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((owner) => {
    if (!isRecord(owner)) return [];
    const { user_id, name } = owner;
    if (typeof user_id !== 'number' || typeof name !== 'string') return [];
    return [{ user_id, name }];
  });
}

/**
 * Resolve a ledger row's `event` into the project's shape.
 *
 * `null` in, `null` out: a `MeteredOccurrence` outlives its event by design
 * (`event_id` is a soft reference), so a null event is an expected state the
 * ledger renders as "Event deleted" with the charge intact — never an error.
 */
export function normalizeLedgerEvent(
  event: LedgerEvent | null | undefined
): NormalizedLedgerEvent | null {
  if (event === null || event === undefined) return null;

  const extras = event as Record<string, unknown>;
  return {
    id: event.id,
    title: typeof extras.title === 'string' ? extras.title : null,
    calendar: readCalendar(extras.calendar),
    owners: readOwners(extras.owners),
  };
}
