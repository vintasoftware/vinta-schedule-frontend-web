import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils/index';

/**
 * Scheduling chip — a calendar event block whose color carries its state:
 * booked / available / tentative / conflict. Mirrors the Vinta Schedule
 * design system's "scheduling chips" (left accent bar + soft tint).
 */
const schedulingChipVariants = cva(
  'flex flex-col justify-center gap-0.5 rounded-md border-l-[3px] px-2.5 py-1.5 text-xs font-medium',
  {
    variants: {
      status: {
        booked: 'border-vinta-600 bg-vinta-50 text-vinta-800',
        available: 'border-teal-600 bg-teal-100 text-teal-700',
        tentative: 'border-warning bg-amber-100 text-warning',
        conflict: 'border-destructive bg-red-100 text-destructive',
      },
    },
    defaultVariants: {
      status: 'booked',
    },
  }
);

export interface SchedulingChipProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof schedulingChipVariants> {
  title: React.ReactNode;
  meta?: React.ReactNode;
}

function SchedulingChip({
  className,
  status,
  title,
  meta,
  ...props
}: SchedulingChipProps) {
  return (
    <div
      className={cn(schedulingChipVariants({ status }), className)}
      {...props}
    >
      <span className='truncate leading-tight'>{title}</span>
      {meta ? (
        <span className='truncate text-[11px] font-normal opacity-80'>
          {meta}
        </span>
      ) : null}
    </div>
  );
}

export { SchedulingChip, schedulingChipVariants };
