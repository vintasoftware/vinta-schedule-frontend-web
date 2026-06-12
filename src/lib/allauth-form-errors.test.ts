import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';

import {
  applyAllauthFormErrors,
  isAllauthBadRequest,
} from './allauth-form-errors';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const badRequest = (
  errors: Array<{ code: string; message: string; param?: string }>
) => ({
  status: 400,
  errors,
});

describe('isAllauthBadRequest', () => {
  it('recognises an allauth error payload', () => {
    expect(
      isAllauthBadRequest(badRequest([{ code: 'invalid', message: 'Nope' }]))
    ).toBe(true);
  });

  it('rejects non-allauth errors', () => {
    expect(isAllauthBadRequest(new Error('boom'))).toBe(false);
    expect(isAllauthBadRequest(null)).toBe(false);
    expect(isAllauthBadRequest({ status: 400 })).toBe(false);
  });
});

describe('applyAllauthFormErrors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps param errors onto form fields', () => {
    const setError = vi.fn();
    applyAllauthFormErrors(
      badRequest([
        { code: 'invalid', message: 'Too weak.', param: 'new_password' },
      ]),
      {
        setError,
        paramMap: { new_password: 'newPassword' },
      }
    );
    expect(setError).toHaveBeenCalledWith('newPassword', {
      type: 'server',
      message: 'Too weak.',
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('matches params against listed fields directly', () => {
    const setError = vi.fn();
    applyAllauthFormErrors(
      badRequest([{ code: 'invalid', message: 'Bad email.', param: 'email' }]),
      { setError, fields: ['email'] }
    );
    expect(setError).toHaveBeenCalledWith('email', {
      type: 'server',
      message: 'Bad email.',
    });
  });

  it('sends unmapped and non-field errors to a toast', () => {
    const setError = vi.fn();
    applyAllauthFormErrors(
      badRequest([
        { code: 'invalid', message: 'Unknown field.', param: 'other' },
        { code: 'forbidden', message: 'Not allowed.' },
      ]),
      { setError, fields: ['email'] }
    );
    expect(setError).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Unknown field.');
    expect(toast.error).toHaveBeenCalledWith('Not allowed.');
  });

  it('falls back to a generic toast for non-allauth errors', () => {
    applyAllauthFormErrors(new Error('network down'), {
      fallbackMessage: 'Something broke.',
    });
    expect(toast.error).toHaveBeenCalledWith('Something broke.');
  });
});
