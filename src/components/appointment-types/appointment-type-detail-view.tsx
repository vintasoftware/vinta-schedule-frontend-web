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
import type { AppointmentType } from '@/client';
import { useCanMintBookingLinkForAppointmentType } from './appointment-type-permissions-provider';
import { MintBookingLinkDialog } from '@/components/booking-links/mint-booking-link-dialog';
import { PublicSchedulingSettings } from './public-scheduling-settings';
import {
  usePermissions,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';
import { SlotRoster } from './slot-roster';
import { EditAppointmentTypeDialog } from './edit-appointment-type-dialog';

export interface AppointmentTypeDetailViewProps {
  appointmentType: AppointmentType;
}

/**
 * AppointmentTypeDetailView — the appointment type detail page's body: a header with the appointment type's
 * name and description, then one section per slot showing its name, required
 * count, the calendar pools feeding it, and its roster (SlotRoster).
 *
 * The per-calendar configuration under each roster row is still read-only here.
 * What an admin can now edit is the appointment type's own shape — name, slots, rosters,
 * pool attachments — through EditAppointmentTypeDialog, alongside the two other writes
 * this page already carried: minting a scheduling link (additive, not an edit
 * of the appointment type), and `PublicSchedulingSettings`, which owns its own
 * admin/read-only split rather than this view re-deriving it. A member sees
 * neither the edit affordance nor the dialog: every appointment-type-shape write is
 * admin-only on the API.
 */
export function AppointmentTypeDetailView({
  appointmentType,
}: AppointmentTypeDetailViewProps) {
  const [mintDialogOpen, setMintDialogOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const permissions = usePermissions();
  const isAdmin = permissions?.includes(PERMISSIONS.manageMembers) ?? false;

  // "Participates in" = owns at least one calendar in the appointment type's slot
  // roster, matching `appointmentTypeHasOwnedCalendar` (appointment-types-table.tsx).
  const appointmentTypeCalendarIds = React.useMemo(
    () =>
      appointmentType.slots.flatMap((slot) => slot.calendars.map((c) => c.id)),
    [appointmentType.slots]
  );
  const canMintLink = useCanMintBookingLinkForAppointmentType(
    appointmentTypeCalendarIds
  );

  return (
    <Stack gap={6}>
      <PageHeader
        title={appointmentType.name}
        description={appointmentType.description}
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
                  data-testid='edit-appointment-type-button'
                >
                  <Pencil aria-hidden />
                  Edit appointment type
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
            kind: 'appointmentType',
            id: appointmentType.id,
            name: appointmentType.name,
            duration: appointmentType.duration,
          }}
        />
      )}
      {isAdmin && (
        <EditAppointmentTypeDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          appointmentType={appointmentType}
        />
      )}
      <PublicSchedulingSettings appointmentType={appointmentType} />
      {appointmentType.slots.length === 0 ? (
        <Text color='muted-foreground' size='sm'>
          This appointment type has no slots.
        </Text>
      ) : (
        <VStack gap={4}>
          {appointmentType.slots.map((slot) => (
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
                <SlotRoster
                  appointmentTypeId={appointmentType.id}
                  slot={slot}
                />
              </CardContent>
            </Card>
          ))}
        </VStack>
      )}
    </Stack>
  );
}
