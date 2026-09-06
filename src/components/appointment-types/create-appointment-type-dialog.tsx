'use client';

/**
 * CreateAppointmentTypeDialog — the create entry point for an Appointment Type.
 *
 * The form itself lives in AppointmentTypeFormDialog, which the edit flow shares; this is
 * the create-mode binding of it.
 */

import { AppointmentTypeFormDialog } from './appointment-type-form-dialog';

export interface CreateAppointmentTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAppointmentTypeDialog({
  open,
  onOpenChange,
}: CreateAppointmentTypeDialogProps) {
  return <AppointmentTypeFormDialog open={open} onOpenChange={onOpenChange} />;
}
