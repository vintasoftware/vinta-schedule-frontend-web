'use client';

/**
 * BillingPeriodsPage — the closed-period statement history (Phase 7).
 *
 * This is the client island for the `/billing/periods` route: it owns the
 * filter + pagination state, reads `useBillingPeriods(filters)`, and hands the
 * resulting page of statements to the presentational `PeriodStatementList`.
 * (Unlike the Phase-2 overview, which splits a server page from a client
 * island, the list route folds the two together — the data-loading, filter
 * wiring, and pagination the deliverable assigns to the page ARE the client
 * concern, and the only named list component is the presentational
 * `PeriodStatementList`.)
 *
 * The API returns statements newest-first (`-billing_period_start`), paginated
 * (limit/offset), and accepts `billing_period_start_after` /
 * `billing_period_start_before` date filters plus a `charged` boolean. An org
 * with no closed periods gets an empty `200` list — an explicit "no statements
 * yet" empty state, NOT an error (history is forward-only).
 */

import * as React from 'react';

import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Label } from 'vinta-schedule-design-system/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'vinta-schedule-design-system/ui/select';
import {
  Center,
  HStack,
  Stack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';

import type { BillingUsagePeriodsListData } from '@/client';
import { useBillingPeriods } from '@/hooks/billing/use-billing-periods';

import { PeriodStatementList } from '@/components/billing/period-statement-list';

const PAGE_SIZE = 20;

type ChargedFilter = 'all' | 'charged' | 'uncharged';

export default function BillingPeriodsPage() {
  const [startAfter, setStartAfter] = React.useState('');
  const [startBefore, setStartBefore] = React.useState('');
  const [charged, setCharged] = React.useState<ChargedFilter>('all');
  const [offset, setOffset] = React.useState(0);

  const isFiltered =
    startAfter !== '' || startBefore !== '' || charged !== 'all';

  // Any filter change resets to the first page — an offset carried over from a
  // wider result set could land past the end of the narrowed one.
  const applyFilter = React.useCallback(<T,>(setter: (value: T) => void) => {
    return (value: T) => {
      setter(value);
      setOffset(0);
    };
  }, []);

  const filters: BillingUsagePeriodsListData['query'] = {
    limit: PAGE_SIZE,
    offset,
    ...(startAfter ? { billing_period_start_after: startAfter } : {}),
    ...(startBefore ? { billing_period_start_before: startBefore } : {}),
    ...(charged !== 'all' ? { charged: charged === 'charged' } : {}),
  };

  const { periods, totalCount, isLoading, isError } = useBillingPeriods({
    filters,
  });

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < totalCount;

  return (
    <>
      <PageHeader
        title='Statements'
        description='Your closed billing periods and what was charged each cycle.'
      />

      <Stack gap={5}>
        <HStack gap={4} align='end' wrap>
          <VStack gap={1} align='start'>
            <Label htmlFor='period-start-after'>From</Label>
            <Input
              id='period-start-after'
              type='date'
              value={startAfter}
              onChange={(event) =>
                applyFilter(setStartAfter)(event.target.value)
              }
              data-testid='filter-start-after'
            />
          </VStack>
          <VStack gap={1} align='start'>
            <Label htmlFor='period-start-before'>To</Label>
            <Input
              id='period-start-before'
              type='date'
              value={startBefore}
              onChange={(event) =>
                applyFilter(setStartBefore)(event.target.value)
              }
              data-testid='filter-start-before'
            />
          </VStack>
          <VStack gap={1} align='start'>
            <Label htmlFor='period-charged'>Charged</Label>
            <Select
              value={charged}
              onValueChange={(value) =>
                applyFilter(setCharged)(value as ChargedFilter)
              }
            >
              <SelectTrigger id='period-charged' data-testid='filter-charged'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All</SelectItem>
                <SelectItem value='charged'>Charged</SelectItem>
                <SelectItem value='uncharged'>Not charged</SelectItem>
              </SelectContent>
            </Select>
          </VStack>
        </HStack>

        {isLoading ? (
          <Center grow>
            <Text color='muted-foreground'>Loading statements…</Text>
          </Center>
        ) : isError ? (
          <Alert data-testid='statements-load-error'>
            <AlertTitle>Couldn&apos;t load statements</AlertTitle>
            <AlertDescription>
              We couldn&apos;t load your billing statements right now. Please
              try again in a moment.
            </AlertDescription>
          </Alert>
        ) : (
          <PeriodStatementList periods={periods} isFiltered={isFiltered} />
        )}

        {(hasPrev || hasNext) && (
          <HStack justify='between' align='center'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={!hasPrev}
              onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
              data-testid='statements-prev'
            >
              Previous
            </Button>
            <Text size='sm' color='muted-foreground'>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, totalCount)} of{' '}
              {totalCount}
            </Text>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={!hasNext}
              onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
              data-testid='statements-next'
            >
              Next
            </Button>
          </HStack>
        )}
      </Stack>
    </>
  );
}
