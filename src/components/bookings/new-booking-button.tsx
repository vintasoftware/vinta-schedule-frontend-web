'use client';

/**
 * NewBookingButton — a button that opens the BookingFormDialog.
 *
 * Extracted as a client component so it can be imported from the events page
 * (a Server Component). The dialog state is self-contained here.
 */

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@vinta-schedule/design-system/ui/button';
import { BookingFormDialog } from '@/components/bookings/booking-form';

export function NewBookingButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className='h-4 w-4' aria-hidden='true' />
        New booking
      </Button>
      <BookingFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
