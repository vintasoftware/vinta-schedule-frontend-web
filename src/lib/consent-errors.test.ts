import { describe, it, expect } from 'vitest';
import {
  isConsentRequiredError,
  CONSENT_REQUIRED_CODE,
} from './consent-errors';

describe('CONSENT_REQUIRED_CODE', () => {
  it('exports the consent_required code constant', () => {
    expect(CONSENT_REQUIRED_CODE).toBe('consent_required');
  });
});

describe('isConsentRequiredError', () => {
  // =========================================================================
  // Positive cases: should return true
  // =========================================================================

  it('detects a 403 consent_required payload with wrapped shape', () => {
    const error = {
      status: 403,
      errors: [
        {
          code: 'consent_required',
          message: 'SMS consent is required before phone verification.',
        },
      ],
    };
    expect(isConsentRequiredError(error)).toBe(true);
  });

  it('detects a direct { errors: [...] } shape', () => {
    const error = {
      errors: [{ code: 'consent_required', message: 'Consent required.' }],
    };
    expect(isConsentRequiredError(error)).toBe(true);
  });

  it('detects consent_required even with other errors in the array', () => {
    const error = {
      status: 403,
      errors: [
        { code: 'other_error', message: 'Some other error.' },
        { code: 'consent_required', message: 'Consent required.' },
      ],
    };
    expect(isConsentRequiredError(error)).toBe(true);
  });

  it('detects consent_required when message is missing', () => {
    const error = {
      status: 403,
      errors: [{ code: 'consent_required' }],
    };
    expect(isConsentRequiredError(error)).toBe(true);
  });

  it('detects the canonical verify-phone 403 gate error (Phase 8 relies on this shape)', () => {
    // The exact shape returned by verify-phone when SMS consent is missing
    // (per plan API Design section 4.4).
    const error = {
      status: 403,
      errors: [
        {
          code: 'consent_required',
          message:
            'SMS consent is required before a verification code can be sent.',
        },
      ],
    };
    expect(isConsentRequiredError(error)).toBe(true);
  });

  // =========================================================================
  // Negative cases: should return false
  // =========================================================================

  it('rejects null', () => {
    expect(isConsentRequiredError(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isConsentRequiredError(undefined)).toBe(false);
  });

  it('rejects a plain Error object', () => {
    expect(isConsentRequiredError(new Error('boom'))).toBe(false);
  });

  it('rejects a string', () => {
    expect(isConsentRequiredError('error')).toBe(false);
  });

  it('matches on code regardless of HTTP status (status is not gated)', () => {
    const error = {
      status: 400,
      errors: [{ code: 'consent_required', message: 'Still not 403.' }],
    };
    // The detector doesn't check status, so this still returns true.
    // (Status checking is optional per the spec.)
    expect(isConsentRequiredError(error)).toBe(true);
  });

  it('rejects an error without an errors array', () => {
    const error = { status: 403, message: 'Forbidden' };
    expect(isConsentRequiredError(error)).toBe(false);
  });

  it('rejects an error with a non-array errors field', () => {
    const error = {
      status: 403,
      errors: 'not an array',
    };
    expect(isConsentRequiredError(error)).toBe(false);
  });

  it('rejects an error with an empty errors array', () => {
    const error = {
      status: 403,
      errors: [],
    };
    expect(isConsentRequiredError(error)).toBe(false);
  });

  it('rejects an error with errors that lack code field', () => {
    const error = {
      status: 403,
      errors: [{ message: 'No code here.' }],
    };
    expect(isConsentRequiredError(error)).toBe(false);
  });

  it('rejects an error with errors that have a different code', () => {
    const error = {
      status: 403,
      errors: [{ code: 'permission_denied', message: 'Different error code.' }],
    };
    expect(isConsentRequiredError(error)).toBe(false);
  });

  it('rejects an object with no properties', () => {
    expect(isConsentRequiredError({})).toBe(false);
  });

  it('handles errors array with null/undefined items safely', () => {
    const error = {
      status: 403,
      errors: [null, undefined, { code: 'other' }],
    };
    expect(isConsentRequiredError(error)).toBe(false);
  });
});
