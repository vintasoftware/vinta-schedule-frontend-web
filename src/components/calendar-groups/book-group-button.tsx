'use client';

/**
 * BookGroupButton — opens the GroupBookingFlow dialog.
 *
 * Client component so it can be dropped into the events page (a Server
 * Component) alongside the single-booking button. Dialog state is local.
 */

import * as React from 'react';
import { Users } from 'lucide-react';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { GroupBookingFlow } from '@/components/calendar-groups/group-booking-flow';

export function BookGroupButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant='outline' onClick={() => setOpen(true)}>
        <Users aria-hidden='true' />
        Book a group
      </Button>
      <GroupBookingFlow open={open} onOpenChange={setOpen} />
    </>
  );
}
