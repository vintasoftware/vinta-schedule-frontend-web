/**
 * form-errors tests.
 *
 * The premise under test: the generated client throws the parsed response body,
 * not an `Error`, so field messages must be read off the body's shape and routed
 * to the matching input — and anything with no matching input must still reach
 * the user rather than being swallowed by `setError`'s no-op on unknown paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UseFormReturn } from 'react-hook-form';

import { applyServerFieldErrors, handleMutationError } from './form-errors';
import { NETWORK_ERROR_MESSAGE } from './api-errors';

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}));

type TestValues = {
  name: string;
  billing_address: { street_name: string };
};

function makeForm(
  values: TestValues = { name: '', billing_address: { street_name: '' } }
) {
  const setError = vi.fn();
  return {
    form: {
      getValues: () => values,
      setError,
    } as unknown as UseFormReturn<TestValues>,
    setError,
  };
}

beforeEach(() => {
  toastError.mockClear();
});

describe('applyServerFieldErrors', () => {
  it('attaches a field message to its matching input', () => {
    const { form, setError } = makeForm();

    const result = applyServerFieldErrors(
      { name: ['This field is required.'] },
      form
    );

    expect(result).toEqual({ handled: true, unmapped: [] });
    expect(setError).toHaveBeenCalledWith('name', {
      message: 'This field is required.',
    });
  });

  it('attaches a nested field message to its dot-joined path', () => {
    const { form, setError } = makeForm();

    const result = applyServerFieldErrors(
      { billing_address: { street_name: ['Too short.'] } },
      form
    );

    expect(result).toEqual({ handled: true, unmapped: [] });
    expect(setError).toHaveBeenCalledWith('billing_address.street_name', {
      message: 'Too short.',
    });
  });

  it('routes non_field_errors to the form root', () => {
    const { form, setError } = makeForm();

    const result = applyServerFieldErrors(
      { non_field_errors: ['That combination already exists.'] },
      form
    );

    expect(result).toEqual({ handled: true, unmapped: [] });
    expect(setError).toHaveBeenCalledWith('root', {
      message: 'That combination already exists.',
    });
  });

  it('reports a field the form has no input for instead of dropping it', () => {
    const { form, setError } = makeForm();

    const result = applyServerFieldErrors(
      { capacity: ['Must be positive.'] },
      form
    );

    expect(result).toEqual({
      handled: false,
      unmapped: ['Capacity: Must be positive.'],
    });
    expect(setError).not.toHaveBeenCalled();
  });
});

describe('handleMutationError', () => {
  it('shows no toast when the form absorbed every message', () => {
    const { form } = makeForm();

    const shown = handleMutationError(
      { name: ['Required.'] },
      {
        title: 'Failed to save',
        form,
      }
    );

    expect(shown).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('toasts the server detail when there is no form', () => {
    const shown = handleMutationError(
      { detail: 'You do not have permission.' },
      { title: 'Failed to save' }
    );

    expect(shown).toBe('You do not have permission.');
    expect(toastError).toHaveBeenCalledWith('Failed to save', {
      description: 'You do not have permission.',
    });
  });

  it('toasts messages the form had no input for', () => {
    const { form } = makeForm();

    const shown = handleMutationError(
      { name: ['Required.'], capacity: ['Must be positive.'] },
      { title: 'Failed to save', form }
    );

    expect(shown).toBe('Capacity: Must be positive.');
    expect(toastError).toHaveBeenCalledWith('Failed to save', {
      description: 'Capacity: Must be positive.',
    });
  });

  it('reports a transport failure as a connectivity problem', () => {
    const shown = handleMutationError(new TypeError('Failed to fetch'), {
      title: 'Failed to save',
    });

    expect(shown).toBe(NETWORK_ERROR_MESSAGE);
  });
});
