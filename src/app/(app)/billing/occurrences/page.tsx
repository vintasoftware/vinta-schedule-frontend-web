'use client';

/**
 * BillingOccurrencesPage — the metered-occurrence ledger (Phase 8), the
 * line-item audit surface behind the org's post-paid charges. Client island for
 * `/billing/occurrences`: it owns the role gate, the filter + pagination state,
 * reads `useOccurrenceLedger(filters)`, and hands the page of rows to the
 * presentational `OccurrenceLedgerTable`.
 *
 * SECURITY BOUNDARY — this is the one billing surface that exposes calendar
 * content (event titles, owners) across the pooled subtree, and the endpoint is
 * billing-owner/admin only (stricter than the other reads). The gate is layered:
 *
 *   1. CLIENT ROLE GATE. Only `useRole() === 'admin'` renders the ledger. A
 *      non-admin sees the access-denied state, and the ledger query is DISABLED
 *      for them (`enabled: isAdmin`) — no request is issued, so rows are never
 *      even fetched, let alone shown. While the role is still loading (`null`),
 *      a neutral loading state shows, never a flash of the table or the denial.
 *   2. SERVER 403 BACKSTOP. The server `403` is the real gate: a
 *      billing-owner-who-isn't-admin is served by the API, and a wrong/stale
 *      client role always degrades to denied. When the query errors, the row
 *      area renders the access-denied (or a validation message) state, NEVER the
 *      table — so a member can never see a ledger row.
 *
 * The `organization` filter is restricted to pool orgs only (options are sourced
 * from the usage `by_organization` breakdown + the observed rows' own orgs), so
 * an id outside the caller's pooled subtree can never be selected. Filters:
 * `billing_period_start` (omitted → API defaults to the current period), an
 * overage-only toggle (`is_within_allowance=false`), an `occurrence_start` date
 * range, `organization`, and limit/offset pagination.
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
import { Switch } from 'vinta-schedule-design-system/ui/switch';
import {
  Center,
  HStack,
  Stack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';

import type { BillingUsageOccurrencesListData } from '@/client';
import { useOccurrenceLedger } from '@/hooks/billing/use-occurrence-ledger';
import { useBillingUsage } from '@/hooks/billing/use-billing-usage';
import { useRole } from '@/components/navigation/role-gate';
import { readNonFieldError } from '@/lib/utils/api-errors';

import { OccurrenceLedgerTable } from '@/components/billing/occurrence-ledger-table';

const PAGE_SIZE = 50;

const ALL_ORGS = 'all';

/**
 * Reads a filter-validation message out of a thrown ledger error — an
 * out-of-pool `organization` id is a validation error (per the API contract),
 * not an empty result, so we surface it distinctly from an access denial.
 * Handles both a DRF `non_field_errors` body and a per-field
 * `{ organization: ["..."] }` body. Returns `null` for anything else (e.g. a
 * `403`), which then degrades to the access-denied state.
 */
function readFilterValidationMessage(error: unknown): string | null {
  const nonField = readNonFieldError(error);
  if (nonField) {
    return nonField;
  }
  if (error === null || typeof error !== 'object') {
    return null;
  }
  const body = error as Record<string, unknown>;
  const fieldError = body.organization;
  if (Array.isArray(fieldError) && typeof fieldError[0] === 'string') {
    return fieldError[0];
  }
  return null;
}

function AccessDenied() {
  return (
    <Alert data-testid='occurrence-ledger-access-denied'>
      <AlertTitle>You don&apos;t have billing access</AlertTitle>
      <AlertDescription>
        The occurrence ledger is available to organization admins and billing
        owners. Please ask an admin if you need to audit these charges.
      </AlertDescription>
    </Alert>
  );
}

export default function BillingOccurrencesPage() {
  const role = useRole();
  const isAdmin = role === 'admin';

  const [periodStart, setPeriodStart] = React.useState('');
  const [overageOnly, setOverageOnly] = React.useState(false);
  const [startAfter, setStartAfter] = React.useState('');
  const [startBefore, setStartBefore] = React.useState('');
  const [organization, setOrganization] = React.useState<string>(ALL_ORGS);
  const [offset, setOffset] = React.useState(0);

  const isFiltered =
    periodStart !== '' ||
    overageOnly ||
    startAfter !== '' ||
    startBefore !== '' ||
    organization !== ALL_ORGS;

  // Any filter change resets to the first page — an offset carried over from a
  // wider result set could land past the end of the narrowed one.
  const applyFilter = React.useCallback(<T,>(setter: (value: T) => void) => {
    return (value: T) => {
      setter(value);
      setOffset(0);
    };
  }, []);

  const filters: BillingUsageOccurrencesListData['query'] = {
    limit: PAGE_SIZE,
    offset,
    // `billing_period_start` is omitted unless the user picks one — the API then
    // defaults to the current, open billing period.
    ...(periodStart ? { billing_period_start: periodStart } : {}),
    // The overage-only toggle is exactly `is_within_allowance: false`; off means
    // "all rows", so the param is omitted rather than sent as `true`.
    ...(overageOnly ? { is_within_allowance: false } : {}),
    ...(startAfter ? { occurrence_start_after: startAfter } : {}),
    ...(startBefore ? { occurrence_start_before: startBefore } : {}),
    ...(organization !== ALL_ORGS
      ? { organization: Number(organization) }
      : {}),
  };

  // The ledger query is DISABLED for a non-admin: no request is issued, so a
  // member never even fetches a row. The server `403` remains the real gate for
  // an admin whose access the API denies.
  const { occurrences, totalCount, isLoading, isError, error } =
    useOccurrenceLedger({ filters, enabled: isAdmin });

  // Usage is the pool-wide source for the org filter's options + the plan
  // currency for `unit_price`. Read only when the ledger is (admin), since a
  // non-admin never renders the filter or the table.
  const { usage } = useBillingUsage({ enabled: isAdmin });

  const currency = usage?.plan?.currency ?? null;

  // Pool orgs the filter may offer — sourced from the usage `by_organization`
  // attribution (pool-wide) plus the observed rows' own orgs. An id outside the
  // pool is never in either source, so it can never be selected.
  const poolOrgs = React.useMemo(() => {
    const byId = new Map<number, string>();
    for (const limit of usage?.limits ?? []) {
      for (const org of limit.by_organization) {
        byId.set(org.organization_id, org.name);
      }
    }
    for (const occurrence of occurrences) {
      byId.set(occurrence.organization.id, occurrence.organization.name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id - b.id);
  }, [usage, occurrences]);

  // Options the org Select actually offers. Once an org is selected the result
  // set (and thus `poolOrgs`) can collapse to just that org — or, if its rows
  // disappear, drop it entirely. Either way the active org must stay a
  // selectable option so its label still shows and the user can return to
  // "All"; add a synthetic entry if it's no longer in `poolOrgs`.
  const orgOptions = React.useMemo(() => {
    if (organization === ALL_ORGS) {
      return poolOrgs;
    }
    const selectedId = Number(organization);
    if (poolOrgs.some((org) => org.id === selectedId)) {
      return poolOrgs;
    }
    return [
      ...poolOrgs,
      { id: selectedId, name: `Organization ${selectedId}` },
    ].sort((a, b) => a.id - b.id);
  }, [poolOrgs, organization]);

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < totalCount;

  // Role still loading — never flash the table or the denial before we know.
  if (role === null) {
    return (
      <Center grow>
        <Text color='muted-foreground'>Loading…</Text>
      </Center>
    );
  }

  // CLIENT ROLE GATE — a non-admin never sees the filters or the table.
  if (!isAdmin) {
    return (
      <Stack gap={6}>
        <PageHeader
          title='Occurrence ledger'
          description='Every metered occurrence behind your post-paid charges.'
        />
        <AccessDenied />
      </Stack>
    );
  }

  const validationMessage = isError ? readFilterValidationMessage(error) : null;

  return (
    <>
      <PageHeader
        title='Occurrence ledger'
        description='Every metered occurrence behind your post-paid charges, newest first.'
      />

      <Stack gap={5}>
        <HStack gap={4} align='end' wrap>
          <VStack gap={1} align='start'>
            <Label htmlFor='occurrence-period-start'>Billing period</Label>
            <Input
              id='occurrence-period-start'
              type='date'
              value={periodStart}
              onChange={(event) =>
                applyFilter(setPeriodStart)(event.target.value)
              }
              data-testid='filter-period-start'
            />
          </VStack>
          <VStack gap={1} align='start'>
            <Label htmlFor='occurrence-start-after'>Starts after</Label>
            <Input
              id='occurrence-start-after'
              type='date'
              value={startAfter}
              onChange={(event) =>
                applyFilter(setStartAfter)(event.target.value)
              }
              data-testid='filter-start-after'
            />
          </VStack>
          <VStack gap={1} align='start'>
            <Label htmlFor='occurrence-start-before'>Starts before</Label>
            <Input
              id='occurrence-start-before'
              type='date'
              value={startBefore}
              onChange={(event) =>
                applyFilter(setStartBefore)(event.target.value)
              }
              data-testid='filter-start-before'
            />
          </VStack>
          {(poolOrgs.length > 1 || organization !== ALL_ORGS) && (
            <VStack gap={1} align='start'>
              <Label htmlFor='occurrence-organization'>Organization</Label>
              <Select
                value={organization}
                onValueChange={(value) => applyFilter(setOrganization)(value)}
              >
                <SelectTrigger
                  id='occurrence-organization'
                  data-testid='filter-organization'
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ORGS}>All organizations</SelectItem>
                  {orgOptions.map((org) => (
                    <SelectItem key={org.id} value={String(org.id)}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </VStack>
          )}
          <HStack gap={2} align='center'>
            <Switch
              id='occurrence-overage-only'
              checked={overageOnly}
              onCheckedChange={(checked) =>
                applyFilter(setOverageOnly)(checked)
              }
              data-testid='filter-overage-only'
            />
            <Label htmlFor='occurrence-overage-only'>Overage only</Label>
          </HStack>
        </HStack>

        {isLoading ? (
          <Center grow>
            <Text color='muted-foreground'>Loading ledger…</Text>
          </Center>
        ) : isError ? (
          validationMessage ? (
            <Alert data-testid='occurrence-ledger-error'>
              <AlertTitle>Couldn&apos;t apply that filter</AlertTitle>
              <AlertDescription>{validationMessage}</AlertDescription>
            </Alert>
          ) : (
            // This branch is admin-only: the member/non-admin access-denied
            // state is rendered earlier by the role gate, with no fetch. An
            // admin who hits an unclassified error — a `403`, a `500`, or a
            // network failure, all indistinguishable since the client throws
            // only the response body — must NOT be told they lack access; a
            // legitimately-entitled admin could see that during an outage.
            // Show a neutral load-failure message instead. Still no rows on any
            // error — the security property is unchanged.
            <Alert data-testid='occurrence-ledger-load-error'>
              <AlertTitle>Couldn&apos;t load the ledger</AlertTitle>
              <AlertDescription>
                We couldn&apos;t load the occurrence ledger right now. Please
                try again in a moment.
              </AlertDescription>
            </Alert>
          )
        ) : (
          <OccurrenceLedgerTable
            occurrences={occurrences}
            currency={currency}
            isFiltered={isFiltered}
          />
        )}

        {(hasPrev || hasNext) && !isError && (
          <HStack justify='between' align='center'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={!hasPrev}
              onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
              data-testid='occurrences-prev'
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
              data-testid='occurrences-next'
            >
              Next
            </Button>
          </HStack>
        )}
      </Stack>
    </>
  );
}
