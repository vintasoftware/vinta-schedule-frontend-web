'use client';

/**
 * CalendarScopePicker — SCAFFOLD (Phase 0e).
 *
 * A props-driven control for selecting which calendar to display in the
 * CalendarView. Fully wired in Phase 15; for now it is a presentational
 * component driven by `calendars` + `value` + `onChange` props.
 *
 * Design: renders as a shadcn/ui <Select> so it picks up all the token-based
 * styling automatically (border-border, bg-background, text-foreground, etc.).
 * No fetching, no hooks — the parent supplies the calendar list.
 */

import * as React from 'react';
import { Combobox } from '@/components/ui/combobox';
import { HStack, Text } from '@/components/layout';
import { CalendarDays } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarOption {
  /** Calendar id from the API. */
  id: number;
  /** Display name for the calendar. */
  name: string;
}

export interface CalendarScopePickerProps {
  /**
   * The available calendars to choose from.
   * Provided by the parent; fetching is NOT done inside this component
   * (wired in Phase 15).
   */
  calendars: CalendarOption[];
  /**
   * The currently selected calendar id, or `null` to show "All calendars".
   */
  value: number | null;
  /**
   * Called when the user selects a different calendar.
   * Receives the new calendar id or `null` for "All calendars".
   */
  onChange: (calendarId: number | null) => void;
  /** When true the picker is rendered as disabled. Defaults to false. */
  disabled?: boolean;
  /** Additional class name for the root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Sentinel value for the "All calendars" option
// ---------------------------------------------------------------------------
const ALL_CALENDARS_VALUE = '__all__';

// ---------------------------------------------------------------------------
// CalendarScopePicker
// ---------------------------------------------------------------------------

export function CalendarScopePicker({
  calendars,
  value,
  onChange,
  disabled = false,
  className,
}: CalendarScopePickerProps): React.ReactElement {
  const selectValue = value === null ? ALL_CALENDARS_VALUE : String(value);

  const handleChange = (next: string) => {
    if (next === ALL_CALENDARS_VALUE) {
      onChange(null);
    } else {
      const parsed = parseInt(next, 10);
      if (!isNaN(parsed)) onChange(parsed);
    }
  };

  return (
    <HStack
      data-slot='calendar-scope-picker'
      align='center'
      gap={2}
      className={className}
    >
      <CalendarDays
        className='text-muted-foreground size-4 shrink-0'
        aria-hidden
      />
      <Text size='sm' color='muted-foreground' className='shrink-0'>
        Calendar:
      </Text>
      <Combobox
        options={[
          { value: ALL_CALENDARS_VALUE, label: 'All calendars' },
          ...calendars.map((cal) => ({ value: String(cal.id), label: cal.name })),
        ]}
        value={selectValue}
        onValueChange={handleChange}
        disabled={disabled}
        placeholder='Select calendar'
        searchPlaceholder='Search calendars…'
        className='h-8 min-w-[160px] text-sm'
      />
    </HStack>
  );
}
