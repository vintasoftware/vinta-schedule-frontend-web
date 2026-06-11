'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils/index';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional secondary line shown below the label */
  description?: string;
}

interface ComboboxBaseProps {
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Called on every keystroke in the search input. Use for server-side search. */
  onSearchChange?: (search: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

interface ComboboxSingleProps extends ComboboxBaseProps {
  multiple?: false;
  value?: string;
  onValueChange: (value: string) => void;
}

interface ComboboxMultipleProps extends ComboboxBaseProps {
  multiple: true;
  value?: string[];
  onValueChange: (value: string[]) => void;
}

export type ComboboxProps = ComboboxSingleProps | ComboboxMultipleProps;

// ---------------------------------------------------------------------------
// Combobox
// ---------------------------------------------------------------------------

export function Combobox(props: ComboboxProps) {
  const {
    options,
    placeholder = 'Select…',
    searchPlaceholder = 'Search…',
    emptyText = 'No results found.',
    onSearchChange,
    isLoading = false,
    disabled = false,
    className,
  } = props;

  const [open, setOpen] = React.useState(false);

  const isMultiple = props.multiple === true;
  const selectedValues: string[] = isMultiple
    ? (props.value ?? [])
    : props.value
      ? [props.value]
      : [];

  const handleSelect = (optionValue: string) => {
    if (isMultiple) {
      const current = props.value ?? [];
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      (props as ComboboxMultipleProps).onValueChange(next);
    } else {
      (props as ComboboxSingleProps).onValueChange(
        optionValue === props.value ? '' : optionValue
      );
      setOpen(false);
    }
  };

  const handleRemoveBadge = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMultiple) {
      const current = props.value ?? [];
      (props as ComboboxMultipleProps).onValueChange(
        current.filter((v) => v !== optionValue)
      );
    }
  };

  const selectedOptions = selectedValues
    .map((v) => options.find((o) => o.value === v))
    .filter((o): o is ComboboxOption => o !== undefined);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'min-h-9 h-auto w-full justify-between',
            isMultiple && selectedValues.length > 0
              ? 'px-2 py-1.5'
              : '',
            className
          )}
        >
          {isMultiple && selectedOptions.length > 0 ? (
            <span className='flex flex-wrap gap-1'>
              {selectedOptions.map((o) => (
                <Badge key={o.value} variant='secondary' className='gap-0.5 pr-1'>
                  {o.label}
                  <button
                    aria-label={`Remove ${o.label}`}
                    className='ml-0.5 rounded-full hover:bg-muted'
                    onMouseDown={(e) => handleRemoveBadge(o.value, e)}
                  >
                    <X className='h-3 w-3' />
                  </button>
                </Badge>
              ))}
            </span>
          ) : (
            <span className='text-muted-foreground font-normal'>
              {!isMultiple && selectedOptions[0]
                ? selectedOptions[0].label
                : placeholder}
            </span>
          )}
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>

      <PopoverContent className='w-[var(--radix-popover-trigger-width)] p-0' align='start'>
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder={searchPlaceholder}
            onValueChange={onSearchChange}
          />
          <CommandList>
            {isLoading ? (
              <CommandEmpty>Searching…</CommandEmpty>
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={handleSelect}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className='flex flex-col'>
                      <span>{option.label}</span>
                      {option.description && (
                        <span className='text-muted-foreground text-xs'>
                          {option.description}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
