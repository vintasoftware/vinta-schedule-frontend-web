/**
 * OccurrenceLedgerRow — one row of the metered-occurrence ledger
 * (`MeteredOccurrence`), the line item behind a post-paid charge.
 *
 * Presentational: renders a single `<TableRow>` from the occurrence it is given
 * (the `/billing/occurrences` route owns the fetch, filters, and pagination).
 * Renders from props only, so it stays a Server Component.
 *
 * Two contract subtleties this row is careful about:
 *
 *   • `event === null` is an EXPECTED state, not an error. A `MeteredOccurrence`
 *     outlives its event by design (`event_id` is a soft reference), so a row
 *     whose event was later deleted still stands — the charge is real and
 *     `unit_price` is intact. It renders "Event deleted" and KEEPS the price,
 *     never hiding or crashing the row.
 *   • `event.title` is the SERIES ROOT's title, not this individual
 *     occurrence's own. A modified occurrence shows the master's title, which
 *     can confuse a customer comparing against their calendar — so the title
 *     carries an explicit caveat affordance.
 */

import { Info } from 'lucide-react';

import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { TableCell, TableRow } from 'vinta-schedule-design-system/ui/table';
import { HStack, Text } from 'vinta-schedule-design-system/layout';

import type { MeteredOccurrence } from '@/client';
import { formatMoney, formatPeriod } from '@/lib/billing/format';

/** The caveat surfaced on every event title: it is the series root's, not the
 *  individual occurrence's. Exported so tests assert on the same string. */
export const SERIES_ROOT_TITLE_CAVEAT =
  'Shows the event series title, not this individual occurrence’s own.';

export interface OccurrenceLedgerRowProps {
  occurrence: MeteredOccurrence;
  /**
   * ISO-4217 currency for `unit_price`, sourced from the plan snapshot. `null`
   * when no plan currency is available (e.g. a subscription-less pool): the
   * price then renders as its raw decimal, never with a guessed symbol.
   */
  currency: string | null;
}

export function OccurrenceLedgerRow({
  occurrence,
  currency,
}: OccurrenceLedgerRowProps) {
  const { event } = occurrence;
  const owners = event?.owners.map((owner) => owner.name).join(', ') ?? '';

  return (
    <TableRow data-testid={`occurrence-row-${occurrence.id}`}>
      <TableCell data-testid='occurrence-row-organization'>
        <Text size='sm'>{occurrence.organization.name}</Text>
      </TableCell>

      <TableCell data-testid='occurrence-row-event'>
        {event === null ? (
          // Expected state: the event was deleted after being metered. The
          // charge still stands — the row and its price are intact.
          <Text size='sm' color='muted-foreground' italic>
            Event deleted
          </Text>
        ) : (
          <HStack gap={1} align='center'>
            <Text size='sm' truncate>
              {event.title}
            </Text>
            <Icon
              icon={Info}
              size='xs'
              color='muted-foreground'
              role='img'
              aria-label={SERIES_ROOT_TITLE_CAVEAT}
            />
          </HStack>
        )}
      </TableCell>

      <TableCell data-testid='occurrence-row-calendar'>
        <Text
          size='sm'
          color={event?.calendar ? undefined : 'muted-foreground'}
        >
          {event?.calendar?.name ?? '—'}
        </Text>
      </TableCell>

      <TableCell data-testid='occurrence-row-owners'>
        <Text size='sm' color={owners ? undefined : 'muted-foreground'}>
          {owners || '—'}
        </Text>
      </TableCell>

      <TableCell data-testid='occurrence-row-start'>
        <Text size='sm'>{formatPeriod(occurrence.occurrence_start)}</Text>
      </TableCell>

      <TableCell data-testid='occurrence-row-allowance'>
        {occurrence.is_within_allowance ? (
          <Badge variant='secondary'>Included</Badge>
        ) : (
          <Badge variant='warning'>Overage</Badge>
        )}
      </TableCell>

      <TableCell data-testid='occurrence-row-price'>
        <Text size='sm' weight='medium'>
          {currency
            ? formatMoney(occurrence.unit_price, currency)
            : occurrence.unit_price}
        </Text>
      </TableCell>
    </TableRow>
  );
}
