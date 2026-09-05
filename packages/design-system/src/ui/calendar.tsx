'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from 'react-day-picker';

import { cn } from '../lib/utils';
import { Button, buttonVariants } from './button';

/**
 * Calendar — thin shadcn/ui wrapper around `react-day-picker`'s `DayPicker`.
 *
 * This is the ONLY file in the repo allowed to import from `react-day-picker`
 * (and, transitively, `date-fns`). The app standardizes on luxon for every
 * other date need — see `@/lib/datetime`. Confining the date-fns dependency
 * to this atom keeps it out of the rest of the bundle; consumers pass and
 * receive plain `Date` objects and never need date-fns themselves.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  buttonVariant = 'ghost',
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant'];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      data-slot='calendar'
      className={cn('w-fit p-3', className)}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn(
          'relative flex flex-col gap-4 sm:flex-row',
          defaultClassNames.months
        ),
        month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between',
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant, size: 'icon' }),
          'size-8 select-none p-0 aria-disabled:opacity-50',
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant, size: 'icon' }),
          'size-8 select-none p-0 aria-disabled:opacity-50',
          defaultClassNames.button_next
        ),
        month_caption: cn(
          'flex h-8 w-full items-center justify-center px-8',
          defaultClassNames.month_caption
        ),
        caption_label: cn(
          'text-sm font-medium select-none',
          defaultClassNames.caption_label
        ),
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'text-muted-foreground w-9 flex-1 rounded-md text-xs font-normal select-none',
          defaultClassNames.weekday
        ),
        week: cn('mt-1 flex w-full', defaultClassNames.week),
        day: cn(
          'group/day relative aspect-square h-9 w-full p-0 text-center select-none',
          defaultClassNames.day
        ),
        today: cn(
          'bg-accent text-accent-foreground rounded-md',
          defaultClassNames.today
        ),
        outside: cn(
          'text-muted-foreground aria-selected:text-muted-foreground',
          defaultClassNames.outside
        ),
        disabled: cn(
          'text-muted-foreground opacity-40',
          defaultClassNames.disabled
        ),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className: rootClassName, rootRef, ...rootProps }) => (
          <div
            data-slot='calendar'
            ref={rootRef}
            className={cn(rootClassName)}
            {...rootProps}
          />
        ),
        Chevron: ({ className: chevronClassName, orientation, ...rest }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('size-4', chevronClassName)} {...rest} />
          ) : (
            <ChevronRight
              className={cn('size-4', chevronClassName)}
              {...rest}
            />
          ),
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant='ghost'
      size='icon'
      data-day={day.date.toLocaleDateString()}
      data-selected-single={modifiers.selected}
      className={cn(
        'data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground size-9 font-normal',
        className
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
