'use client';

/**
 * TransferEventDialog — admin dialog to transfer an event to another calendar.
 *
 * Allows the admin to select a destination calendar from all org calendars,
 * validate the selection, and confirm the transfer. Shows loading state while
 * pending and disables the submit button until a destination is chosen.
 *
 * Props:
 *   - `open` — dialog visibility.
 *   - `onOpenChange` — callback when the dialog opens/closes.
 *   - `eventId` — the numeric event id to transfer.
 *   - `eventTitle` — the event title for display in confirmation.
 *   - `onTransferred` — callback after successful transfer (typically closes
 *     the parent event detail sheet).
 */

import * as React from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { VStack } from '@/components/layout';
import { useAllCalendars } from '@/hooks/calendars/use-all-calendars';
import { useTransferEvent } from '@/hooks/events/use-transfer-event';

export interface TransferEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  eventTitle: string;
  onTransferred?: () => void;
}

export function TransferEventDialog({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  onTransferred,
}: TransferEventDialogProps) {
  const [selectedCalendarId, setSelectedCalendarId] = React.useState('');

  // Fetch all calendars (admin org-wide scope).
  const { calendars, isLoading: calendarsLoading } = useAllCalendars({
    page: 1,
    pageSize: 100,
    ordering: null,
    search: null,
  });

  const { transferEvent, transferEventMutation } = useTransferEvent();
  const isPending = transferEventMutation.isPending;

  const handleTransfer = async () => {
    const destCalId = parseInt(selectedCalendarId, 10);
    if (isNaN(destCalId) || destCalId <= 0) {
      toast.error('Please select a valid destination calendar');
      return;
    }

    try {
      await transferEvent(eventId, destCalId);
      toast.success('Event transferred', {
        description: `"${eventTitle}" has been moved.`,
      });
      setSelectedCalendarId('');
      onOpenChange(false);
      onTransferred?.();
    } catch (err) {
      toast.error('Failed to transfer event', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isPending) {
      setSelectedCalendarId('');
      onOpenChange(isOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer event</DialogTitle>
          <DialogDescription>
            Select a destination calendar for{' '}
            <span className='font-medium'>{eventTitle}</span>.
          </DialogDescription>
        </DialogHeader>

        <VStack gap={4}>
          {/* Destination calendar picker */}
          <VStack gap={2}>
            <Label
              htmlFor='transfer-destination-calendar'
              className='font-semibold'
            >
              Destination calendar
            </Label>
            <Combobox
              id='transfer-destination-calendar'
              options={calendars.map((cal) => ({
                value: String(cal.id),
                label: cal.name,
              }))}
              value={selectedCalendarId}
              onValueChange={setSelectedCalendarId}
              disabled={calendarsLoading || isPending}
              placeholder='Choose a calendar'
              searchPlaceholder='Search calendars…'
            />
          </VStack>
        </VStack>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={isPending || !selectedCalendarId || calendarsLoading}
          >
            {isPending ? 'Transferring…' : 'Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
