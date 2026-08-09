'use client';

/**
 * BillingPeriodDetailPage — one closed-period statement's detail (Phase 7).
 *
 * A client route: it unwraps its `[id]` param, reads
 * `useBillingPeriod(id)`, and renders the `PeriodStatementDetail` composition
 * (header snapshot + per-resource breakdown, with `total: null` shown as
 * "Not recorded" — never `0` — and `limit_value: null` as "Unlimited").
 *
 * A pk outside the caller's pool answers `404`; the generated retrieve factory
 * throws the parsed body (`{ detail: "Not found." }`), which `isNotFoundError`
 * recognizes — so an out-of-pool id renders the not-found state rather than
 * crashing. Any other failure renders a generic, retryable error. The URL is
 * left in place (no redirect) so the browser back button still works.
 */

import { use } from 'react';
import Link from 'next/link';
import { SearchX } from 'lucide-react';

import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { Spinner } from 'vinta-schedule-design-system/ui/spinner';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { Heading, Text, VStack } from 'vinta-schedule-design-system/layout';

import { useBillingPeriod } from '@/hooks/billing/use-billing-period';
import { isNotFoundError } from '@/lib/utils/api-errors';

import { PeriodStatementDetail } from '@/components/billing/period-statement-detail';

export default function BillingPeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { period, isLoading, isError, error } = useBillingPeriod(id);

  if (isLoading) {
    return (
      <VStack align='center' py={16}>
        <Spinner label='Loading statement' />
      </VStack>
    );
  }

  // An out-of-pool / missing pk is a 404 — the non-disclosure not-found body,
  // rendered as a calm not-found state, never a crash.
  if (isError && isNotFoundError(error)) {
    return (
      <VStack gap={3} align='center' py={16} data-testid='period-not-found'>
        <Icon icon={SearchX} size='xl' color='muted-foreground' />
        <Heading level={2} size='lg' align='center'>
          Statement not found
        </Heading>
        <Text color='muted-foreground' size='sm' align='center'>
          This billing statement isn&apos;t available. It may not exist, or you
          may not have access to it.
        </Text>
        <TextLink asChild>
          <Link href='/billing/periods'>Back to statements</Link>
        </TextLink>
      </VStack>
    );
  }

  if (isError || period === null) {
    return (
      <VStack gap={2} py={6} align='center' data-testid='period-load-error'>
        <Text color='destructive' weight='medium'>
          Couldn&apos;t load this statement.
        </Text>
        <Text color='muted-foreground' size='sm'>
          Please try again in a moment.
        </Text>
      </VStack>
    );
  }

  return (
    <>
      <PageHeader
        title='Statement'
        description='What was counted and charged for this billing period.'
      />
      <PeriodStatementDetail period={period} />
    </>
  );
}
