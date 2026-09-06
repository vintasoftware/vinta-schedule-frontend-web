'use client';

/**
 * BookAppointmentTypeButton — opens the AppointmentTypeBookingFlow dialog.
 *
 * Client component so it can be dropped into the events page (a Server
 * Component) alongside the single-booking button. Dialog state is local.
 */

import * as React from 'react';
import { Users } from 'lucide-react';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { AppointmentTypeBookingFlow } from '@/components/appointment-types/appointment-type-booking-flow';

export function BookAppointmentTypeButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant='outline' onClick={() => setOpen(true)}>
        <Users aria-hidden='true' />
        Book an appointment type
      </Button>
      <AppointmentTypeBookingFlow open={open} onOpenChange={setOpen} />
    </>
  );
}
