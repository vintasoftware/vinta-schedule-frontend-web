'use client';

/**
 * CreateGroupDialog — the create entry point for a Calendar Group.
 *
 * The form itself lives in GroupFormDialog, which the edit flow shares; this is
 * the create-mode binding of it.
 */

import { GroupFormDialog } from './group-form-dialog';

export interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({
  open,
  onOpenChange,
}: CreateGroupDialogProps) {
  return <GroupFormDialog open={open} onOpenChange={onOpenChange} />;
}
