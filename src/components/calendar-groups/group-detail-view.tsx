'use client';

import * as React from 'react';
import { Link2 } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from 'vinta-schedule-design-system/ui/card';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';
import {
  Stack,
  VStack,
  HStack,
  Text,
} from 'vinta-schedule-design-system/layout';
import type { CalendarGroup } from '@/client';
import { useCanMintBookingLinkForGroup } from './group-permissions-provider';
import { MintBookingLinkDialog } from '@/components/booking-links/mint-booking-link-dialog';
import { SlotRoster } from './slot-roster';

export interface GroupDetailViewProps {
  group: CalendarGroup;
}

/**
 * GroupDetailView — the group detail page's body: a header with the group's
 * name and description, then one section per slot showing its name,
 * required count, and roster (SlotRoster).
 *
 * Editing the group, its slots, or the slot rosters is out of scope for this
 * page — everything here is read-only (Non-goals, plan §1). Minting a
 * scheduling link is a new, additive action rather than an edit to the group
 * itself, so it lives in the header's actions slot without disturbing that
 * read-only contract.
 */
export function GroupDetailView({ group }: GroupDetailViewProps) {
  const [mintDialogOpen, setMintDialogOpen] = React.useState(false);

  // "Participates in" = owns at least one calendar in the group's slot
  // roster, matching `groupHasOwnedCalendar` (groups-table.tsx).
  const groupCalendarIds = React.useMemo(
    () => group.slots.flatMap((slot) => slot.calendars.map((c) => c.id)),
    [group.slots]
  );
  const canMintLink = useCanMintBookingLinkForGroup(groupCalendarIds);

  return (
    <Stack gap={6}>
      <PageHeader
        title={group.name}
        description={group.description}
        actions={
          canMintLink ? (
            <Button size='sm' onClick={() => setMintDialogOpen(true)}>
              <Link2 aria-hidden />
              Get scheduling link
            </Button>
          ) : undefined
        }
      />
      {canMintLink && (
        <MintBookingLinkDialog
          open={mintDialogOpen}
          onOpenChange={setMintDialogOpen}
          target={{
            kind: 'group',
            id: group.id,
            name: group.name,
            duration: group.duration,
          }}
        />
      )}
      {group.slots.length === 0 ? (
        <Text color='muted-foreground' size='sm'>
          This group has no slots.
        </Text>
      ) : (
        <VStack gap={4}>
          {group.slots.map((slot) => (
            <Card key={slot.id} data-testid={`slot-section-${slot.id}`}>
              <CardHeader>
                <HStack gap={2} align='center' justify='between'>
                  <CardTitle>{slot.name}</CardTitle>
                  <Badge variant='secondary'>
                    Requires {slot.required_count ?? 1}
                  </Badge>
                </HStack>
                {slot.description ? (
                  <CardDescription>{slot.description}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent>
                <SlotRoster groupId={group.id} slot={slot} />
              </CardContent>
            </Card>
          ))}
        </VStack>
      )}
    </Stack>
  );
}
