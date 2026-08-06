'use client';

import * as React from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from 'vinta-schedule-design-system/ui/accordion';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Spinner } from 'vinta-schedule-design-system/ui/spinner';
import {
  Divider,
  HStack,
  VStack,
  Text,
} from 'vinta-schedule-design-system/layout';
import type { Calendar, CalendarGroupSlot } from '@/client';
import {
  useGroupScopedConfigSummary,
  SUMMARY_PAGE_SIZE,
  type CalendarConfigSummary,
} from '@/hooks/calendar-groups/use-group-scoped-config-summary';
import { useCanEditCalendar } from './group-permissions-provider';
import { GroupWindowGrid } from './group-window-grid';
import { UnsupportedWindowList } from './unsupported-window-list';
import { GroupBlockList } from './group-block-list';
import { GroupQuotaRules } from './group-quota-rules';

const CALENDAR_TYPE_LABEL: Record<Calendar['calendar_type'], string> = {
  personal: 'Personal',
  resource: 'Resource',
  virtual: 'Virtual',
  bundle: 'Bundle',
};

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

// When the slot's group-scoped rows for a concept outnumber the single page
// fetched (see use-group-scoped-config-summary.ts), the per-calendar count
// is a lower bound — render it as `200+` rather than a precise-looking
// number the summary can't back up.
function formatSummary(
  summary: CalendarConfigSummary,
  isTruncated: boolean
): string {
  if (isTruncated) {
    return `${SUMMARY_PAGE_SIZE}+ configured (exact count unavailable)`;
  }
  return [
    pluralize(summary.windowCount, 'window'),
    pluralize(summary.blockCount, 'block'),
    pluralize(summary.quotaCount, 'quota rule'),
  ].join(' · ');
}

export interface SlotRosterProps {
  groupId: number;
  slot: CalendarGroupSlot;
}

interface SlotRosterRowProps {
  groupId: number;
  slotId: number;
  calendar: Calendar;
  summary: CalendarConfigSummary;
  isSummaryLoading: boolean;
  isSummaryError: boolean;
  isSummaryTruncated: boolean;
}

/**
 * SlotRosterRow — one calendar's row + expandable panel. Split out from
 * SlotRoster so each row can call `useCanEditCalendar` independently (a
 * hook can't be called inside the parent's `.map()` without breaking the
 * Rules of Hooks across renders with a different roster size).
 *
 * Editability comes from GroupPermissionsProvider (mounted by the group
 * detail page), not from a prop — every row asks the same shared
 * predicate. A row the viewer cannot edit renders WITHOUT a write
 * affordance, rather than with one that's merely disabled, so nothing on
 * the page suggests an action the viewer cannot take (Phase 2).
 */
function SlotRosterRow({
  groupId,
  slotId,
  calendar,
  summary,
  isSummaryLoading,
  isSummaryError,
  isSummaryTruncated,
}: SlotRosterRowProps) {
  const canEdit = useCanEditCalendar(calendar.id);

  return (
    <AccordionItem value={`calendar-${calendar.id}`}>
      <AccordionTrigger data-testid={`roster-row-${calendar.id}`}>
        <HStack
          gap={3}
          align='center'
          justify='between'
          className='flex-1 pr-2'
        >
          <HStack gap={2} align='center'>
            <Text weight='medium'>{calendar.name}</Text>
            <Badge variant='secondary'>
              {CALENDAR_TYPE_LABEL[calendar.calendar_type]}
            </Badge>
            {!canEdit ? (
              <Badge
                variant='outline'
                data-testid={`roster-row-readonly-badge-${calendar.id}`}
              >
                Read-only
              </Badge>
            ) : null}
          </HStack>
          {isSummaryLoading ? (
            <Spinner size='xs' label='Loading configuration counts' />
          ) : isSummaryError ? (
            <Text size='xs' color='destructive'>
              Unable to load configuration counts
            </Text>
          ) : (
            <Text size='xs' color='muted-foreground'>
              {formatSummary(summary, isSummaryTruncated)}
            </Text>
          )}
        </HStack>
      </AccordionTrigger>
      <AccordionContent>
        {/* Phase 3b/3c fill the windows section, Phase 4 the blocks section,
            Phase 5 the quota section below -- GroupWindowGrid, GroupBlockList,
            and GroupQuotaRules all read their own editability from
            `useCanEditCalendar`, so they're mounted the same way in both
            branches here. */}
        <VStack
          gap={4}
          p={4}
          border
          radius='md'
          data-testid={`roster-panel-${calendar.id}`}
        >
          {canEdit ? (
            <VStack
              gap={4}
              data-testid={`roster-panel-editable-${calendar.id}`}
            >
              <GroupWindowGrid
                groupId={groupId}
                slotId={slotId}
                calendarId={calendar.id}
                calendarName={calendar.name}
              />
              <Divider />
              <UnsupportedWindowList
                groupId={groupId}
                slotId={slotId}
                calendarId={calendar.id}
              />
              <Divider />
              <GroupBlockList
                groupId={groupId}
                slotId={slotId}
                calendarId={calendar.id}
                calendarName={calendar.name}
              />
              <Divider />
              <GroupQuotaRules
                groupId={groupId}
                slotId={slotId}
                calendarId={calendar.id}
              />
            </VStack>
          ) : (
            <VStack
              gap={4}
              data-testid={`roster-panel-readonly-${calendar.id}`}
            >
              <Text color='muted-foreground' size='sm'>
                Only this calendar&apos;s owner or an organization admin can
                configure its group-scoped settings.
              </Text>
              <GroupWindowGrid
                groupId={groupId}
                slotId={slotId}
                calendarId={calendar.id}
                calendarName={calendar.name}
              />
              <Divider />
              <UnsupportedWindowList
                groupId={groupId}
                slotId={slotId}
                calendarId={calendar.id}
              />
              <Divider />
              <GroupBlockList
                groupId={groupId}
                slotId={slotId}
                calendarId={calendar.id}
                calendarName={calendar.name}
              />
              <Divider />
              <GroupQuotaRules
                groupId={groupId}
                slotId={slotId}
                calendarId={calendar.id}
              />
            </VStack>
          )}
        </VStack>
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * SlotRoster — one slot's roster: every calendar in its candidate pool, its
 * type, and a summary of how much group-scoped configuration exists for it
 * (read from the windows / blocks / quota list queries).
 *
 * Each row expands into a panel; Phase 3b fills the windows section (the
 * weekday grid and the read-only unsupported-window list), Phase 4 mounts
 * the blocks section (GroupBlockList) next to it, and Phase 5 mounts quota.
 */
export function SlotRoster({ groupId, slot }: SlotRosterProps) {
  const { summaryFor, isLoading, isError, isTruncated } =
    useGroupScopedConfigSummary({
      groupId,
      slotId: slot.id,
    });

  if (slot.calendars.length === 0) {
    return (
      <Text color='muted-foreground' size='sm'>
        No calendars in this slot&apos;s roster.
      </Text>
    );
  }

  return (
    <Accordion type='multiple' data-testid={`slot-roster-${slot.id}`}>
      {slot.calendars.map((calendar) => (
        <SlotRosterRow
          key={calendar.id}
          groupId={groupId}
          slotId={slot.id}
          calendar={calendar}
          summary={summaryFor(calendar.id)}
          isSummaryLoading={isLoading}
          isSummaryError={isError}
          isSummaryTruncated={isTruncated}
        />
      ))}
    </Accordion>
  );
}
