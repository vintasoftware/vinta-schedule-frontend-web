'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { cn } from '@/lib/utils/index';

// ---------------------------------------------------------------------------
// DataTableToolbar
//
// A search/filter bar for the DataTable. The search input debounces its
// value (300 ms default) before calling onSearchChange so the parent's URL
// update and data re-fetch is not triggered on every keystroke.
// ---------------------------------------------------------------------------

export interface DataTableToolbarProps {
  /** Current search value (controlled). */
  search: string | null;
  /** Called when the debounced search value changes. */
  onSearchChange: (value: string | null) => void;
  /** Debounce delay in ms. Defaults to 300. */
  debounceMs?: number;
  /** Extra content to render on the right side of the toolbar (e.g. filter chips, action buttons). */
  actions?: React.ReactNode;
  /**
   * Whether to show the search input. Defaults to true.
   * Pass false when the underlying API does not support search (e.g. /organization-members/).
   */
  showSearch?: boolean;
  className?: string;
}

export function DataTableToolbar({
  search,
  onSearchChange,
  debounceMs = 300,
  actions,
  showSearch = true,
  className,
}: DataTableToolbarProps) {
  // Local input value allows typing without a URL push on every keystroke.
  const [inputValue, setInputValue] = React.useState(search ?? '');

  // Sync inbound controlled value → local when it changes externally
  // (e.g. reset or back-navigation).
  React.useEffect(() => {
    setInputValue(search ?? '');
  }, [search]);

  // Debounce: fire onSearchChange after the user stops typing.
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearchChange(value.trim() || null);
    }, debounceMs);
  };

  const handleClear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setInputValue('');
    onSearchChange(null);
  };

  // Clean up the debounce timer on unmount.
  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // When there is nothing to render (no search, no actions), skip the toolbar row entirely.
  if (!showSearch && !actions) return null;

  return (
    <div
      data-slot='data-table-toolbar'
      className={cn('flex items-center justify-between gap-2 py-2', className)}
    >
      {showSearch ? (
        <div className='relative flex w-full max-w-sm items-center'>
          <Search className='text-muted-foreground absolute left-2.5 size-4' />
          <Input
            aria-label='Search'
            placeholder='Search…'
            value={inputValue}
            onChange={handleChange}
            className='pr-8 pl-8'
          />
          {inputValue && (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label='Clear search'
              onClick={handleClear}
              className='absolute right-1 size-6'
            >
              <X className='size-4' />
            </Button>
          )}
        </div>
      ) : (
        // Spacer so actions slot stays right-aligned even without a search box.
        <div />
      )}
      {actions && (
        <div className='flex shrink-0 items-center gap-2'>{actions}</div>
      )}
    </div>
  );
}
