'use client';

/**
 * ScopePromptDialog — Google-Calendar-style scope selector for mutations on
 * recurring events.
 *
 * Shows three options:
 *   - "This event"           → scope = 'this'       (single occurrence exception)
 *   - "This and following"   → scope = 'following'  (bulk-modify from this occurrence)
 *   - "All events"           → scope = 'all'        (whole series / series destroy)
 *
 * Callers (cancel, reschedule, edit — Phases 20–24) open this dialog when the
 * target event has `isRecurring === true`. Non-recurring events skip the dialog
 * entirely (caller responsibility to check `event.isRecurring`).
 *
 * Props:
 *   open           — controlled open state
 *   onOpenChange   — toggle handler
 *   eventTitle     — displayed in the dialog description so the user knows
 *                    which event they are acting on
 *   onSelect       — called with the chosen scope; dialog does NOT auto-close —
 *                    the caller must set `onOpenChange(false)` after acting
 *   actionLabel    — action verb shown on the confirm button (e.g. "Cancel",
 *                    "Reschedule", "Edit")
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from 'vinta-schedule-design-system/ui/dialog';
import {
  RadioGroup,
  RadioGroupItem,
} from 'vinta-schedule-design-system/ui/radio-group';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Label } from 'vinta-schedule-design-system/ui/label';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecurringScope = 'this' | 'following' | 'all';

export interface ScopePromptDialogProps {
  /** Controlled open state. */
  open: boolean;
  /** Toggle handler — the caller drives open/close. */
  onOpenChange: (open: boolean) => void;
  /** Title of the recurring event, shown in the description. */
  eventTitle: string;
  /**
   * Called with the user's chosen scope when they click the action button.
   * The dialog does NOT auto-close after calling this — the caller must close
   * it (e.g. after the async operation resolves).
   */
  onSelect: (scope: RecurringScope) => void;
  /**
   * Action label for the confirm button (e.g. "Cancel", "Reschedule", "Edit").
   * Defaults to "Apply".
   */
  actionLabel?: string;
}

// ---------------------------------------------------------------------------
// Option metadata
// ---------------------------------------------------------------------------

interface ScopeOption {
  value: RecurringScope;
  label: string;
  description: string;
}

const SCOPE_OPTIONS: ScopeOption[] = [
  {
    value: 'this',
    label: 'This event',
    description: 'Only this occurrence is affected.',
  },
  {
    value: 'following',
    label: 'This and following events',
    description: 'This and all future occurrences are affected.',
  },
  {
    value: 'all',
    label: 'All events',
    description: 'Every occurrence in the series is affected.',
  },
];

// ---------------------------------------------------------------------------
// ScopePromptDialog
// ---------------------------------------------------------------------------

export function ScopePromptDialog({
  open,
  onOpenChange,
  eventTitle,
  onSelect,
  actionLabel = 'Apply',
}: ScopePromptDialogProps) {
  const [selected, setSelected] = React.useState<RecurringScope>('this');

  // Reset selection to 'this' whenever the dialog opens so each invocation
  // starts from the safest default.
  React.useEffect(() => {
    if (open) {
      setSelected('this');
    }
  }, [open]);

  const handleConfirm = () => {
    onSelect(selected);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{actionLabel} recurring event</DialogTitle>
          <DialogDescription>
            <span className='font-medium'>{eventTitle}</span> is a recurring
            event. Choose which occurrences to {actionLabel.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selected}
          onValueChange={(v) => setSelected(v as RecurringScope)}
          className='mt-2 grid gap-3'
        >
          {SCOPE_OPTIONS.map((opt) => (
            <div key={opt.value} className='flex items-start gap-3'>
              <RadioGroupItem
                value={opt.value}
                id={`scope-${opt.value}`}
                className='mt-0.5'
              />
              <Label
                htmlFor={`scope-${opt.value}`}
                className='cursor-pointer leading-snug'
              >
                <span className='font-medium'>{opt.label}</span>
                <span className='text-muted-foreground mt-0.5 block text-sm font-normal'>
                  {opt.description}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>{actionLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
