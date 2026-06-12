import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';

export interface AllauthFieldError {
  code: string;
  message: string;
  param?: string;
}

interface AllauthBadRequest {
  status: number;
  errors: AllauthFieldError[];
}

export function isAllauthBadRequest(
  error: unknown
): error is AllauthBadRequest {
  return (
    typeof error === 'object' &&
    error !== null &&
    'errors' in error &&
    Array.isArray((error as { errors: unknown }).errors)
  );
}

export interface ApplyAllauthFormErrorsOptions<T extends FieldValues> {
  setError?: UseFormSetError<T>;
  /** Form fields that may receive a server error keyed by allauth `param`. */
  fields?: ReadonlyArray<Path<T>>;
  /** Maps an allauth `param` to a differently-named form field. */
  paramMap?: Partial<Record<string, Path<T>>>;
  fallbackMessage?: string;
}

/**
 * Single mapping point for allauth 400 payloads (`{ errors: [{param, message,
 * code}] }`): errors whose `param` matches a known form field become
 * react-hook-form field errors; everything else — including non-allauth
 * failures — surfaces as a sonner toast so no error is silently dropped.
 */
export function applyAllauthFormErrors<T extends FieldValues>(
  error: unknown,
  {
    setError,
    fields = [],
    paramMap = {},
    fallbackMessage = 'Something went wrong. Please try again.',
  }: ApplyAllauthFormErrorsOptions<T> = {}
): void {
  if (!isAllauthBadRequest(error) || error.errors.length === 0) {
    toast.error(fallbackMessage);
    return;
  }

  for (const fieldError of error.errors) {
    const mappedField = fieldError.param
      ? (paramMap[fieldError.param] ??
        (fields as readonly string[]).find((f) => f === fieldError.param))
      : undefined;

    if (mappedField && setError) {
      setError(mappedField as Path<T>, {
        type: 'server',
        message: fieldError.message,
      });
    } else {
      toast.error(fieldError.message);
    }
  }
}
