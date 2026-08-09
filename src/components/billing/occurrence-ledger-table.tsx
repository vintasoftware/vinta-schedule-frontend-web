/**
 * OccurrenceLedgerTable — the metered-occurrence ledger as a table, one row per
 * `MeteredOccurrence` (the line items behind the org's post-paid charges).
 *
 * Presentational: renders whatever `occurrences` the parent hands it (the
 * `/billing/occurrences` route owns the fetch, filters, and pagination). Renders
 * from props only, so it stays a Server Component.
 *
 * A footnote restates the series-root-title caveat once for the whole table (in
 * addition to the per-row affordance on `OccurrenceLedgerRow`): every event
 * title is the SERIES ROOT's, not the individual occurrence's, so a customer
 * reconciling against their calendar is not surprised.
 *
 * An empty list is a first-class, NON-error state — a period (or filter) with no
 * metered occurrences simply has none to show, distinct from the access-denied /
 * error states the route renders instead of this table.
 */

import { ReceiptText } from 'lucide-react';

import { Icon } from 'vinta-schedule-design-system/ui/icon';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from 'vinta-schedule-design-system/ui/table';
import { Text, VStack } from 'vinta-schedule-design-system/layout';

import type { MeteredOccurrence } from '@/client';

import { OccurrenceLedgerRow } from './occurrence-ledger-row';

export interface OccurrenceLedgerTableProps {
  /** Occurrences to render, already ordered by the API (newest-first). */
  occurrences: MeteredOccurrence[];
  /**
   * ISO-4217 currency for each row's `unit_price`, from the plan snapshot.
   * `null` when no plan currency is available — rows then show the raw decimal.
   */
  currency: string | null;
  /**
   * Whether the empty list is the result of active filters (vs a genuinely
   * empty period). Drives the empty-state copy only.
   */
  isFiltered?: boolean;
}

export function OccurrenceLedgerTable({
  occurrences,
  currency,
  isFiltered = false,
}: OccurrenceLedgerTableProps) {
  if (occurrences.length === 0) {
    return (
      <VStack
        gap={3}
        align='center'
        py={16}
        data-testid='occurrence-ledger-empty'
      >
        <Icon icon={ReceiptText} size='xl' color='muted-foreground' />
        <Text weight='medium' align='center'>
          {isFiltered
            ? 'No occurrences match these filters'
            : 'No metered occurrences this period'}
        </Text>
        <Text color='muted-foreground' size='sm' align='center'>
          {isFiltered
            ? 'Try widening the date range or clearing the filters.'
            : 'Metered occurrences appear here as they are counted this cycle.'}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack gap={2} align='stretch' data-testid='occurrence-ledger-table'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Calendar</TableHead>
            <TableHead>Owners</TableHead>
            <TableHead>Occurrence start</TableHead>
            <TableHead>Allowance</TableHead>
            <TableHead>Unit price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {occurrences.map((occurrence) => (
            <OccurrenceLedgerRow
              key={occurrence.id}
              occurrence={occurrence}
              currency={currency}
            />
          ))}
        </TableBody>
      </Table>
      <Text
        size='xs'
        color='muted-foreground'
        data-testid='occurrence-ledger-footnote'
      >
        Event titles show the series title, not the individual occurrence’s own.
      </Text>
    </VStack>
  );
}
