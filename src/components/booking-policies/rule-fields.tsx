'use client';

/**
 * Shared rule-field building blocks for the booking-policy forms.
 *
 * Both the admin policy dialog and the per-calendar member "Booking rules"
 * dialog edit the same four guardrails as {value, unit} pairs, so the zod
 * schema fragment, the rule metadata, and the number-input + unit-select field
 * live here to avoid drift.
 */

import * as React from 'react';
import { z } from 'zod';
import { Input } from '@vinta-schedule/design-system/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vinta-schedule/design-system/ui/select';
import {
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@vinta-schedule/design-system/ui/form';
import { HStack } from '@vinta-schedule/design-system/layout';
import {
  DURATION_UNIT_OPTIONS,
  secondsToDuration,
  durationToSeconds,
  type DurationUnit,
  type DurationValue,
} from './duration';

// ---------------------------------------------------------------------------
// Schema fragment — one {value, unit} pair, non-negative integer value.
// ---------------------------------------------------------------------------

export const durationFieldSchema = z.object({
  value: z
    .number({ message: 'Enter a number' })
    .int({ message: 'Whole numbers only' })
    .min(0, { message: 'Must be 0 or more' }),
  unit: z.enum(['minutes', 'hours', 'days']),
});

/** The four rule fields shared by both booking-policy forms. */
export const RULE_FIELDS = [
  {
    name: 'lead_time',
    seconds: 'lead_time_seconds',
    label: 'Lead time',
    description: 'Minimum notice before a slot may be booked.',
  },
  {
    name: 'max_horizon',
    seconds: 'max_horizon_seconds',
    label: 'Booking horizon',
    description: 'How far in advance a slot may be booked.',
  },
  {
    name: 'buffer_before',
    seconds: 'buffer_before_seconds',
    label: 'Buffer before',
    description: 'Dead zone kept before each existing event.',
  },
  {
    name: 'buffer_after',
    seconds: 'buffer_after_seconds',
    label: 'Buffer after',
    description: 'Dead zone kept after each existing event.',
  },
] as const;

export type RuleFieldName = (typeof RULE_FIELDS)[number]['name'];

/** The neutral default: zero minutes ("no constraint"). */
export const ZERO_DURATION: DurationValue = { value: 0, unit: 'minutes' };

/** The four rule fields of a form, as {value, unit} pairs. */
export interface RuleFormValues {
  lead_time: DurationValue;
  max_horizon: DurationValue;
  buffer_before: DurationValue;
  buffer_after: DurationValue;
}

/** Build the {value, unit} rule pairs from a policy's stored seconds. */
export function ruleValuesFromSeconds(source: {
  lead_time_seconds?: number;
  max_horizon_seconds?: number;
  buffer_before_seconds?: number;
  buffer_after_seconds?: number;
}): RuleFormValues {
  return {
    lead_time: secondsToDuration(source.lead_time_seconds ?? 0),
    max_horizon: secondsToDuration(source.max_horizon_seconds ?? 0),
    buffer_before: secondsToDuration(source.buffer_before_seconds ?? 0),
    buffer_after: secondsToDuration(source.buffer_after_seconds ?? 0),
  };
}

/** Convert the {value, unit} rule pairs back to the API's *_seconds fields. */
export function ruleValuesToSeconds(values: RuleFormValues): {
  lead_time_seconds: number;
  max_horizon_seconds: number;
  buffer_before_seconds: number;
  buffer_after_seconds: number;
} {
  return {
    lead_time_seconds: durationToSeconds(values.lead_time),
    max_horizon_seconds: durationToSeconds(values.max_horizon),
    buffer_before_seconds: durationToSeconds(values.buffer_before),
    buffer_after_seconds: durationToSeconds(values.buffer_after),
  };
}

// ---------------------------------------------------------------------------
// DurationFormField — the number-input + unit-select for one rule field.
//
// Rendered inside an rhf <FormField> render prop, so it consumes the field's
// {value, onChange} and relies on the surrounding FormField context for
// <FormMessage>.
// ---------------------------------------------------------------------------

interface DurationFormFieldProps {
  field: {
    value: DurationValue;
    onChange: (value: DurationValue) => void;
  };
  label: string;
  description: string;
  disabled?: boolean;
}

export function DurationFormField({
  field,
  label,
  description,
  disabled,
}: DurationFormFieldProps) {
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <HStack gap={2} align='start'>
        <FormControl>
          <Input
            type='number'
            min={0}
            step={1}
            inputMode='numeric'
            className='w-28'
            disabled={disabled}
            aria-label={`${label} value`}
            value={Number.isNaN(field.value.value) ? '' : field.value.value}
            onChange={(e) =>
              field.onChange({
                ...field.value,
                value:
                  e.target.value === '' ? Number.NaN : Number(e.target.value),
              })
            }
          />
        </FormControl>
        <Select
          value={field.value.unit}
          onValueChange={(unit) =>
            field.onChange({ ...field.value, unit: unit as DurationUnit })
          }
          disabled={disabled}
        >
          <SelectTrigger className='w-32' aria-label={`${label} unit`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATION_UNIT_OPTIONS.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </HStack>
      <FormDescription>{description}</FormDescription>
      <FormMessage />
    </FormItem>
  );
}
