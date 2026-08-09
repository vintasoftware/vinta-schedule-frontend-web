/**
 * PeriodStatementList — the list of an organization's closed-period statements
 * (`BillingPeriodSummary[]`), newest first, each row linking to its detail.
 *
 * Presentational: it renders whatever `periods` the parent hands it (the
 * `/billing/periods` route owns the fetch, filters, and pagination) as a list
 * of link-rows. Each row shows the period bounds (`formatPeriod`), the plan
 * snapshot for that period, the overage total (`formatMoney` in THAT row's own
 * `currency` — each closed period carries its own), and whether it was charged.
 *
 * An empty list is a first-class, NON-error state: closed-period history is
 * forward-only, so an org that has not closed a period yet simply has "no
 * statements yet" — never an error. The copy distinguishes an empty history
 * from an empty filtered result via `isFiltered`.
 *
 * Renders from props only, so it stays a Server Component.
 */

import Link from 'next/link';
import { FileClock } from 'lucide-react';

import { Card, CardContent } from 'vinta-schedule-design-system/ui/card';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { HStack, Text, VStack } from 'vinta-schedule-design-system/layout';

import type { BillingPeriodSummary } from '@/client';
import { formatMoney, formatPeriod } from '@/lib/billing/format';

export interface PeriodStatementListProps {
  /** Statements to render, already ordered newest-first by the API. */
  periods: BillingPeriodSummary[];
  /**
   * Whether the empty list is the result of active filters (vs a genuinely
   * empty history). Drives the empty-state copy only.
   */
  isFiltered?: boolean;
}

export function PeriodStatementList({
  periods,
  isFiltered = false,
}: PeriodStatementListProps) {
  if (periods.length === 0) {
    return (
      <VStack
        gap={3}
        align='center'
        py={16}
        data-testid='period-statement-empty'
      >
        <Icon icon={FileClock} size='xl' color='muted-foreground' />
        <Text weight='medium' align='center'>
          {isFiltered
            ? 'No statements match these filters'
            : 'No closed statements yet'}
        </Text>
        <Text color='muted-foreground' size='sm' align='center'>
          {isFiltered
            ? 'Try widening the date range or clearing the charged filter.'
            : 'Statements appear here once a billing period closes.'}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack gap={3} align='stretch' data-testid='period-statement-list'>
      {periods.map((period) => (
        <Link
          key={period.id}
          href={`/billing/periods/${period.id}`}
          data-testid={`period-statement-link-${period.id}`}
          className='focus-visible:ring-ring block rounded-lg focus-visible:ring-2 focus-visible:outline-none'
        >
          <Card className='hover:border-primary transition-colors'>
            <CardContent className='pt-6'>
              <HStack justify='between' gap={4} align='center' wrap>
                <VStack gap={1} align='start'>
                  <Text weight='medium' data-testid='statement-row-period'>
                    {formatPeriod(period.billing_period_start)} –{' '}
                    {formatPeriod(period.billing_period_end)}
                  </Text>
                  <Text size='sm' color='muted-foreground'>
                    {period.plan_name}
                  </Text>
                </VStack>
                <HStack gap={3} align='center'>
                  <Text weight='semibold' data-testid='statement-row-overage'>
                    {formatMoney(period.overage_total, period.currency)}
                  </Text>
                  {period.charged ? (
                    <Badge
                      variant='success'
                      data-testid='statement-row-charged'
                    >
                      Charged
                    </Badge>
                  ) : (
                    <Badge
                      variant='secondary'
                      data-testid='statement-row-not-charged'
                    >
                      Not charged
                    </Badge>
                  )}
                </HStack>
              </HStack>
            </CardContent>
          </Card>
        </Link>
      ))}
    </VStack>
  );
}
