'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { Box, Flex, HStack } from 'vinta-schedule-design-system/layout';

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
    <Flex
      data-slot='data-table-toolbar'
      align='center'
      justify='between'
      gap={2}
      py={2}
      className={className}
    >
      {showSearch ? (
        <Flex
          position='relative'
          align='center'
          width='full'
          maxWidth={384} // max-w-sm
        >
          <Box position='absolute' left={10} display='flex'>
            <Icon icon={Search} size='sm' color='muted-foreground' />
          </Box>
          <Input
            aria-label='Search'
            placeholder='Search…'
            value={inputValue}
            onChange={handleChange}
            // Input has no padding prop — the inset keeps the text clear of the
            // search glyph and the clear button.
            className='pr-8 pl-8'
          />
          {inputValue && (
            <Box position='absolute' right={4} display='flex'>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label='Clear search'
                onClick={handleClear}
                // No 24px icon-button size token exists; `icon` is 36px, which
                // would overflow the 36px-tall input.
                className='size-6'
              >
                <X />
              </Button>
            </Box>
          )}
        </Flex>
      ) : (
        // Spacer so actions slot stays right-aligned even without a search box.
        <Box />
      )}
      {actions && (
        <HStack gap={2} shrink={0}>
          {actions}
        </HStack>
      )}
    </Flex>
  );
}
