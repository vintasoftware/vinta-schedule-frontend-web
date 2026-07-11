'use client';

import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from 'vinta-schedule-design-system/ui/dialog';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import {
  VStack,
  HStack,
  Box,
  Text,
  Divider,
} from 'vinta-schedule-design-system/layout';
import { formatDateTime } from '@/lib/utils/date-utils';
import {
  STATUS_LABELS,
  STATUS_BADGE_VARIANTS,
  KIND_LABELS,
  PROVIDER_LABELS,
  VALUE_FIELDS,
  asChangeRequestValues,
  type ChangeRequestValues,
} from './change-request-metadata';
import type { ExternalEventChangeRequest } from '@/hooks/change-requests/use-change-requests';

// ---------------------------------------------------------------------------
// Value formatting — start_time / end_time are ISO datetimes; everything else
// is shown verbatim. Empty / null values render as an "—" placeholder.
// ---------------------------------------------------------------------------

function formatValue(
  key: keyof ChangeRequestValues,
  value: string | null | undefined
): string {
  if (value == null || value === '') return '—';
  if (key === 'start_time' || key === 'end_time') {
    return formatDateTime(value) ?? value;
  }
  return value;
}

interface ValueRowProps {
  label: string;
  fieldKey: keyof ChangeRequestValues;
  retained: ChangeRequestValues;
  proposed: ChangeRequestValues;
  /** When false (delete requests) only the retained column is shown. */
  showProposed: boolean;
}

function ValueRow({
  label,
  fieldKey,
  retained,
  proposed,
  showProposed,
}: ValueRowProps) {
  const before = formatValue(fieldKey, retained[fieldKey]);
  const after = formatValue(fieldKey, proposed[fieldKey]);
  const changed = showProposed && before !== after;

  return (
    <VStack gap={1}>
      <Text size='xs' color='muted-foreground' weight='medium'>
        {label}
      </Text>
      <HStack gap={2} align='center'>
        <Text size='sm' className={changed ? 'line-through opacity-70' : ''}>
          {before}
        </Text>
        {showProposed && (
          <>
            <ArrowRight
              className='text-muted-foreground size-3.5 shrink-0'
              aria-hidden
            />
            <Text size='sm' weight={changed ? 'medium' : 'normal'}>
              {after}
            </Text>
          </>
        )}
      </HStack>
    </VStack>
  );
}

export interface ChangeRequestDetailDialogProps {
  changeRequest: ExternalEventChangeRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ChangeRequestDetailDialog — read-only side-by-side view of a change request:
 * its retained (current) values vs the proposed values from the provider.
 *
 * For `delete` requests there is no "after" to show, so only the retained
 * column is rendered (the event would be removed).
 */
export function ChangeRequestDetailDialog({
  changeRequest,
  open,
  onOpenChange,
}: ChangeRequestDetailDialogProps) {
  if (!changeRequest) return null;

  const retained = asChangeRequestValues(changeRequest.retained_values);
  const proposed = asChangeRequestValues(changeRequest.proposed_values);
  const showProposed = changeRequest.kind !== 'delete';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Change request #{changeRequest.id}</DialogTitle>
          <DialogDescription>
            {showProposed
              ? 'Current values compared with the change proposed by the provider.'
              : 'This request proposes deleting the event. Shown below are its current values.'}
          </DialogDescription>
        </DialogHeader>

        <VStack gap={3}>
          <HStack gap={2} wrap>
            <Badge variant={STATUS_BADGE_VARIANTS[changeRequest.status]}>
              {STATUS_LABELS[changeRequest.status]}
            </Badge>
            <Badge variant='outline'>{KIND_LABELS[changeRequest.kind]}</Badge>
            <Badge variant='secondary'>
              {PROVIDER_LABELS[changeRequest.provider] ??
                changeRequest.provider}
            </Badge>
          </HStack>

          <Divider />

          {showProposed && (
            <HStack gap={2} align='center'>
              <Text size='xs' color='muted-foreground' className='flex-1'>
                Current
              </Text>
              <Box className='w-3.5 shrink-0' />
              <Text size='xs' color='muted-foreground' className='flex-1'>
                Proposed
              </Text>
            </HStack>
          )}

          <VStack gap={3}>
            {VALUE_FIELDS.map((field) => (
              <ValueRow
                key={field.key}
                label={field.label}
                fieldKey={field.key}
                retained={retained}
                proposed={proposed}
                showProposed={showProposed}
              />
            ))}
          </VStack>

          <Divider />

          <VStack gap={1}>
            <Text size='xs' color='muted-foreground'>
              Requested {formatDateTime(changeRequest.created) ?? '—'}
            </Text>
            {changeRequest.resolved_at && (
              <Text size='xs' color='muted-foreground'>
                Resolved {formatDateTime(changeRequest.resolved_at)}
              </Text>
            )}
          </VStack>
        </VStack>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
