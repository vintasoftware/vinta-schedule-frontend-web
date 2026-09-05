'use client';

import * as React from 'react';
import { Link2, Pencil } from 'lucide-react';
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
import { PublicSchedulingSettings } from './public-scheduling-settings';
import {
  usePermissions,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';
import { SlotRoster } from './slot-roster';
import { EditGroupDialog } from './edit-group-dialog';

export interface GroupDetailViewProps {
  group: CalendarGroup;
}

/**
 * GroupDetailView — the group detail page's body: a header with the group's
 * name and description, then one section per slot showing its name, required
 * count, the calendar pools feeding it, and its roster (SlotRoster).
 *
 * The per-calendar configuration under each roster row is still read-only here.
 * What an admin can now edit is the group's own shape — name, slots, rosters,
 * pool attachments — through EditGroupDialog, alongside the two other writes
 * this page already carried: minting a scheduling link (additive, not an edit
 * of the group), and `PublicSchedulingSettings`, which owns its own
 * admin/read-only split rather than this view re-deriving it. A member sees
 * neither the edit affordance nor the dialog: every group-shape write is
 * admin-only on the API.
 */
export function GroupDetailView({ group }: GroupDetailViewProps) {
  const [mintDialogOpen, setMintDialogOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const permissions = usePermissions();
  const isAdmin = permissions?.includes(PERMISSIONS.manageMembers) ?? false;

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
          canMintLink || isAdmin ? (
            <HStack gap={2}>
              {canMintLink ? (
                <Button size='sm' onClick={() => setMintDialogOpen(true)}>
                  <Link2 aria-hidden />
                  Get scheduling link
                </Button>
              ) : null}
              {isAdmin ? (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setEditOpen(true)}
                  data-testid='edit-group-button'
                >
                  <Pencil aria-hidden />
                  Edit group
                </Button>
              ) : null}
            </HStack>
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
      {isAdmin && (
        <EditGroupDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          group={group}
        />
      )}
      <PublicSchedulingSettings group={group} />
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
                {slot.pools.length > 0 ? (
                  <HStack
                    gap={2}
                    align='center'
                    wrap
                    data-testid={`slot-pools-${slot.id}`}
                  >
                    <Text size='sm' color='muted-foreground'>
                      From pools:
                    </Text>
                    {slot.pools.map((pool) => (
                      <Badge key={pool.id} variant='outline'>
                        {pool.name}
                      </Badge>
                    ))}
                  </HStack>
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
