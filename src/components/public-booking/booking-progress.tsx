/**
 * BookingProgress — a light, honest step indicator for the public booking
 * surface.
 *
 * Each flow supplies EXACTLY the steps it actually has:
 * `public-booking-flow.tsx` (single calendar) has one fewer step than
 * `public-group-booking-flow.tsx` / `codeless-group-booking-flow.tsx`
 * (group, which adds a "choose calendars" step), and `reschedule-flow.tsx`
 * has its own, shorter list. `cancel-flow.tsx` renders none at all — a
 * single confirm action has no "remaining steps" to show, and faking a
 * multi-step indicator for it would lie.
 *
 * Deliberately NOT a design-system atom: this is one small, feature-scoped
 * composition with no reuse outside this surface yet — see DESIGN.md's
 * "compose from primitives" guidance, which this follows (Text/HStack only,
 * no hand-rolled layout classes beyond the connector rule, which token
 * spacing/color props don't reach).
 */

import {
  HStack,
  Text,
  VisuallyHidden,
} from 'vinta-schedule-design-system/layout';
import { cn } from '@/lib/utils';

export interface BookingProgressProps {
  /** Plain-English step labels, in order. */
  steps: string[];
  /** 0-based index of the step the attendee is currently on. */
  currentStep: number;
}

export function BookingProgress({ steps, currentStep }: BookingProgressProps) {
  if (steps.length === 0) return null;

  return (
    <>
      <HStack
        as='ol'
        gap={1}
        align='center'
        wrap
        data-testid='booking-progress'
        aria-label='Booking progress'
      >
        {steps.map((label, index) => {
          const isCurrent = index === currentStep;
          const isDone = index < currentStep;
          return (
            <HStack
              as='li'
              key={label}
              gap={2}
              align='center'
              aria-current={isCurrent ? 'step' : undefined}
            >
              <HStack
                as='span'
                align='center'
                justify='center'
                width={20}
                height={20}
                radius='full'
                border
                aria-hidden
                className={cn(
                  'text-[11px] leading-none font-medium',
                  isDone
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isCurrent
                      ? 'border-primary text-primary'
                      : 'text-muted-foreground'
                )}
              >
                {isDone ? '✓' : index + 1}
              </HStack>
              <Text
                size='xs'
                weight={isCurrent ? 'medium' : 'normal'}
                color={isCurrent ? 'foreground' : 'muted-foreground'}
              >
                {label}
              </Text>
              {index < steps.length - 1 ? (
                <span aria-hidden className='bg-border h-px w-4' />
              ) : null}
            </HStack>
          );
        })}
      </HStack>
      <VisuallyHidden aria-live='polite'>
        Step {currentStep + 1} of {steps.length}
      </VisuallyHidden>
    </>
  );
}
