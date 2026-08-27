/**
 * form-errors.ts — routes a rejected API mutation to where a user will see it.
 *
 * A validation error the server raised about one field belongs on that field's
 * input, not in a toast that disappears. Everything else — a `detail`, a
 * `non_field_errors`, a transport failure — belongs in a toast or at the top of
 * the form.
 *
 * The generated client throws the parsed response body, never an `Error` (see
 * the note above `getApiErrorMessage` in `api-errors.ts`), so all of this reads
 * the thrown value's shape.
 */

import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';

import {
  GENERIC_ERROR_MESSAGE,
  getApiErrorMessage,
  humanizeFieldName,
  readAllauthErrors,
  readFieldValidationErrors,
  readNonFieldError,
} from './api-errors';

/** Reads a dot-joined path (`billing_address.street_name`) off a value tree. */
function hasPath(values: unknown, path: string): boolean {
  let current: unknown = values;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') {
      return false;
    }
    if (!(segment in (current as Record<string, unknown>))) {
      return false;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return true;
}

export interface AppliedFormErrors {
  /** True when at least one message was attached to the form. */
  handled: boolean;
  /**
   * Messages the form has no input for. The server can reject a field the form
   * doesn't render (a serializer-only field, or a field renamed on the backend);
   * `setError` on an unknown path is a silent no-op, so those would vanish.
   * Callers show these instead of dropping them.
   */
  unmapped: string[];
}

/**
 * Attaches a rejection's field messages to their inputs.
 *
 * `non_field_errors` goes to the form's `root` key, which `FormRootMessage`
 * renders at the top of the form.
 */
export function applyServerFieldErrors<TFieldValues extends FieldValues>(
  error: unknown,
  form: UseFormReturn<TFieldValues>
): AppliedFormErrors {
  const unmapped: string[] = [];
  let handled = false;

  const nonField = readNonFieldError(error);
  if (nonField) {
    form.setError('root', { message: nonField });
    handled = true;
  }

  // django-allauth (the auth clients) uses its own shape, with the input name
  // in `param` and no param at all for form-level messages.
  const allauthErrors = readAllauthErrors(error);
  if (allauthErrors) {
    const values = form.getValues();
    for (const { field, message } of allauthErrors) {
      if (field !== null && hasPath(values, field)) {
        form.setError(field as Path<TFieldValues>, { message });
      } else if (field === null) {
        form.setError('root', { message });
      } else {
        unmapped.push(`${humanizeFieldName(field)}: ${message}`);
        continue;
      }
      handled = true;
    }
  }

  const fieldErrors = readFieldValidationErrors(error);
  if (fieldErrors) {
    const values = form.getValues();
    for (const [field, message] of Object.entries(fieldErrors)) {
      if (hasPath(values, field)) {
        form.setError(field as Path<TFieldValues>, { message });
        handled = true;
      } else {
        unmapped.push(`${humanizeFieldName(field)}: ${message}`);
      }
    }
  }

  return { handled, unmapped };
}

export interface HandleMutationErrorOptions<TFieldValues extends FieldValues> {
  /** Toast heading, e.g. `'Failed to create calendar'`. */
  title: string;
  /** When given, field messages are attached to inputs instead of toasted. */
  form?: UseFormReturn<TFieldValues>;
  /** Shown when the rejection carries nothing readable. */
  fallback?: string;
}

/**
 * The default rejection handler for a mutation.
 *
 * With a `form`, field messages land on their inputs and nothing is toasted —
 * the inputs are already showing the problem. Messages with no matching input
 * still get a toast so they are never lost.
 *
 * Returns the toast message shown, or `null` when the form absorbed everything.
 */
export function handleMutationError<TFieldValues extends FieldValues>(
  error: unknown,
  options: HandleMutationErrorOptions<TFieldValues>
): string | null {
  const { title, form, fallback = GENERIC_ERROR_MESSAGE } = options;

  if (form) {
    const { handled, unmapped } = applyServerFieldErrors(error, form);
    if (handled) {
      if (unmapped.length > 0) {
        const description = unmapped.join(' ');
        toast.error(title, { description });
        return description;
      }
      return null;
    }
  }

  const description = getApiErrorMessage(error, fallback);
  toast.error(title, { description });
  return description;
}
