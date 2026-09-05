'use client';

/**
 * EditGroupDialog — the edit entry point for a Calendar Group.
 *
 * The form itself lives in GroupFormDialog, which the create flow shares; this
 * is the edit-mode binding of it. A null `group` renders the dialog closed
 * rather than in create mode, so a table can mount one instance and hand it the
 * row being edited.
 */

import type { CalendarGroup } from '@/client';
import { GroupFormDialog } from './group-form-dialog';

export interface EditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: CalendarGroup | null;
}

export function EditGroupDialog({
  open,
  onOpenChange,
  group,
}: EditGroupDialogProps) {
  if (group === null) return null;

  return (
    <GroupFormDialog open={open} onOpenChange={onOpenChange} group={group} />
  );
}
