'use client';

/**
 * EditAppointmentTypeDialog — the edit entry point for an Appointment Type.
 *
 * The form itself lives in AppointmentTypeFormDialog, which the create flow shares; this
 * is the edit-mode binding of it. A null `appointment type` renders the dialog closed
 * rather than in create mode, so a table can mount one instance and hand it the
 * row being edited.
 */

import type { AppointmentType } from '@/client';
import { AppointmentTypeFormDialog } from './appointment-type-form-dialog';

export interface EditAppointmentTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentType: AppointmentType | null;
}

export function EditAppointmentTypeDialog({
  open,
  onOpenChange,
  appointmentType,
}: EditAppointmentTypeDialogProps) {
  if (appointmentType === null) return null;

  return (
    <AppointmentTypeFormDialog
      open={open}
      onOpenChange={onOpenChange}
      appointmentType={appointmentType}
    />
  );
}
