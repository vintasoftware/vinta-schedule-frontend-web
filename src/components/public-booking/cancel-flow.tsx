'use client';

/**
 * CancelFlow — the attendee-facing flow for `/book/[code]/cancel` (and its
 * branded `/o/[slug]/…` twin).
 *
 * Unlike `RescheduleFlow`, there is no slot picker and no `?target=`
 * routing: `publicBookingEventsCancelCreate` is a single endpoint for both
 * single-calendar and calendar-group events — the deliberately-not-collapsed
 * pair only exists for reschedule (see the plan's Phase 4 body, point 4).
 * There is also no code-gated READ at all on this page — the plan's
 * consumed-operations table lists only the cancel WRITE for this flow — so
 * the first (and only) network call is the confirm click itself.
 *
 * `204 No Content` on success (rule 6 of the phase spec): there is no
 * `CalendarEvent` to render back, so the confirmed state is a plain message
 * rather than `BookingConfirmation` (which requires an event the cancel
 * response never returns).
 *
 * Every failure here is a WRITE failure with the real `{error_code, detail}`
 * vocabulary (`terminalErrorCopy`, imported — not forked — from
 * `public-booking-flow.tsx`), so `ALREADY_USED` is worded distinctly from
 * every other failure and from the reads' opaque "link is no longer valid"
 * copy used elsewhere in this feature.
 */

import * as React from 'react';
import { Ban, CheckCircle2 } from 'lucide-react';
import { Button } from 'vinta-schedule-design-system/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import {
  HStack,
  Heading,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';
import { usePublicCancel } from '@/hooks/booking-codes/use-public-cancel';
import {
  PublicWriteFailureError,
  type PublicWriteFailure,
} from '@/lib/booking-links/errors';
import { terminalErrorCopy } from './public-booking-flow';

type FlowStep = 'confirm' | 'cancelled' | 'terminal-error';

export interface CancelFlowProps {
  /** Plaintext booking code from the URL. */
  code: string;
}

export function CancelFlow({ code }: CancelFlowProps) {
  const [step, setStep] = React.useState<FlowStep>('confirm');
  const [terminalFailure, setTerminalFailure] =
    React.useState<PublicWriteFailure | null>(null);
  const { cancel, cancelMutation } = usePublicCancel();

  const handleCancel = async () => {
    try {
      await cancel({ code });
      setStep('cancelled');
    } catch (err) {
      if (err instanceof PublicWriteFailureError) {
        setTerminalFailure(err.failure);
        setStep('terminal-error');
        return;
      }
      setTerminalFailure({
        errorCode: null,
        detail: 'Something went wrong. Please try again in a moment.',
        isRetryable: false,
      });
      setStep('terminal-error');
    }
  };

  if (step === 'terminal-error' && terminalFailure) {
    const { title, description } = terminalErrorCopy(terminalFailure);
    return (
      <Card data-testid='cancel-terminal-error'>
        <CardHeader>
          <HStack gap={2} align='center'>
            <Icon icon={Ban} color='destructive' aria-hidden />
            <CardTitle>{title}</CardTitle>
          </HStack>
        </CardHeader>
        <CardContent>
          <Text
            color='muted-foreground'
            data-testid='cancel-terminal-error-description'
          >
            {description}
          </Text>
        </CardContent>
      </Card>
    );
  }

  if (step === 'cancelled') {
    return (
      <Card data-testid='cancel-confirmation'>
        <CardHeader>
          <HStack gap={2} align='center'>
            <Icon icon={CheckCircle2} color='success' aria-hidden />
            <CardTitle>Appointment cancelled</CardTitle>
          </HStack>
        </CardHeader>
        <CardContent>
          <Text color='muted-foreground'>
            Your appointment has been cancelled. This link no longer works.
          </Text>
        </CardContent>
      </Card>
    );
  }

  return (
    <VStack gap={4}>
      <Heading level={1} size='xl'>
        Cancel your appointment
      </Heading>
      <Card data-testid='cancel-confirm-card'>
        <CardContent>
          <VStack gap={4}>
            <Text color='muted-foreground'>
              Are you sure you want to cancel this appointment? This can&apos;t
              be undone, and this link will no longer work afterward.
            </Text>
            <HStack gap={2} justify='end'>
              <Button
                type='button'
                onClick={() => void handleCancel()}
                disabled={cancelMutation.isPending}
                data-testid='cancel-confirm-button'
              >
                {cancelMutation.isPending
                  ? 'Cancelling…'
                  : 'Cancel appointment'}
              </Button>
            </HStack>
          </VStack>
        </CardContent>
      </Card>
    </VStack>
  );
}
