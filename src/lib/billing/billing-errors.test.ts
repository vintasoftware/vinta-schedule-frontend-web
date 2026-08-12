import { describe, it, expect } from 'vitest';
import {
  parseBillingError,
  isLimitExceeded,
  isChargeDeclined,
  remedyOf,
  billingErrorMessage,
  type BillingError,
} from './billing-errors';

describe('parseBillingError', () => {
  describe('LimitExceededError', () => {
    it('parses a complete limit_exceeded error', () => {
      const error = parseBillingError({
        code: 'limit_exceeded',
        resource: 'organization_members',
        current_usage: 5,
        limit: 10,
        remedy: 'upgrade_plan',
      });

      expect(error).toEqual({
        code: 'limit_exceeded',
        resource: 'organization_members',
        current_usage: 5,
        limit: 10,
        remedy: 'upgrade_plan',
      });
    });

    it('parses limit_exceeded with null limit (unlimited)', () => {
      const error = parseBillingError({
        code: 'limit_exceeded',
        resource: 'resource_calendars',
        current_usage: 3,
        limit: null,
        remedy: 'purchase_add_on',
      });

      expect(error).toEqual({
        code: 'limit_exceeded',
        resource: 'resource_calendars',
        current_usage: 3,
        limit: null,
        remedy: 'purchase_add_on',
      });
    });

    it('returns unrecognized for limit_exceeded with missing resource', () => {
      const error = parseBillingError({
        code: 'limit_exceeded',
        current_usage: 5,
        limit: 10,
        remedy: 'upgrade_plan',
      });

      expect(error).toEqual({
        type: 'unrecognized',
        original: expect.any(Object),
      });
    });

    it('returns unrecognized for limit_exceeded with non-string resource', () => {
      const error = parseBillingError({
        code: 'limit_exceeded',
        resource: 123,
        current_usage: 5,
        limit: 10,
        remedy: 'upgrade_plan',
      });

      expect(error).toEqual({
        type: 'unrecognized',
        original: expect.any(Object),
      });
    });

    it('returns unrecognized for limit_exceeded with unknown remedy', () => {
      const error = parseBillingError({
        code: 'limit_exceeded',
        resource: 'organization_members',
        current_usage: 1,
        limit: 5,
        remedy: 'not_a_real_remedy',
      });

      expect(error).toEqual({
        type: 'unrecognized',
        original: expect.any(Object),
      });
    });
  });

  describe('CodedBillingError', () => {
    const codedErrors = [
      'payment_token_required',
      'unconfirmed_plan_change',
      'payment_provider_not_configured',
      'add_on_not_purchasable',
      'retry_payment_not_applicable',
      'subscription_not_attached',
      'no_outstanding_balance',
      'collection_not_supported',
      'charge_declined',
    ] as const;

    codedErrors.forEach((code) => {
      it(`parses ${code} error`, () => {
        const error = parseBillingError({
          code,
          detail: 'Something went wrong',
        });

        expect(error).toEqual({
          code,
          detail: 'Something went wrong',
        });
      });
    });

    it('returns unrecognized for coded error with missing detail', () => {
      const error = parseBillingError({
        code: 'payment_token_required',
      });

      expect(error).toEqual({
        type: 'unrecognized',
        original: expect.any(Object),
      });
    });

    it('returns unrecognized for coded error with non-string detail', () => {
      const error = parseBillingError({
        code: 'payment_token_required',
        detail: 123,
      });

      expect(error).toEqual({
        type: 'unrecognized',
        original: expect.any(Object),
      });
    });

    it('returns unrecognized for an unknown code', () => {
      const error = parseBillingError({
        code: 'unknown_error_code',
        detail: 'Some error',
      });

      expect(error).toEqual({
        type: 'unrecognized',
        original: expect.any(Object),
      });
    });
  });

  describe('FieldValidationError', () => {
    it('parses a field validation error with single field', () => {
      const error = parseBillingError({
        contact_email: ['This field is required.'],
      });

      expect(error).toEqual({
        type: 'field_validation',
        fields: {
          contact_email: ['This field is required.'],
        },
      });
    });

    it('parses a field validation error with multiple fields', () => {
      const error = parseBillingError({
        contact_email: ['This field is required.'],
        contact_first_name: ['This field is required.'],
        document_number: ['Invalid document number.'],
      });

      expect(error).toEqual({
        type: 'field_validation',
        fields: {
          contact_email: ['This field is required.'],
          contact_first_name: ['This field is required.'],
          document_number: ['Invalid document number.'],
        },
      });
    });

    it('parses a field validation error with multiple errors per field', () => {
      const error = parseBillingError({
        contact_email: [
          'This field is required.',
          'Enter a valid email address.',
        ],
      });

      expect(error).toEqual({
        type: 'field_validation',
        fields: {
          contact_email: [
            'This field is required.',
            'Enter a valid email address.',
          ],
        },
      });
    });

    it('filters out non-string-array fields from validation errors', () => {
      const error = parseBillingError({
        contact_email: ['This field is required.'],
        status: 'some_string',
        non_field_errors: ['Something went wrong'],
      });

      // Should include fields with string-array values, exclude others
      expect(error).toEqual({
        type: 'field_validation',
        fields: {
          contact_email: ['This field is required.'],
          non_field_errors: ['Something went wrong'],
        },
      });
    });
  });

  describe('Null/undefined/primitive inputs', () => {
    it('returns unrecognized for null', () => {
      const error = parseBillingError(null);

      expect(error).toEqual({
        type: 'unrecognized',
        original: null,
      });
    });

    it('returns unrecognized for undefined', () => {
      const error = parseBillingError(undefined);

      expect(error).toEqual({
        type: 'unrecognized',
        original: undefined,
      });
    });

    it('returns unrecognized for a string', () => {
      const error = parseBillingError('some error');

      expect(error).toEqual({
        type: 'unrecognized',
        original: 'some error',
      });
    });

    it('returns unrecognized for a number', () => {
      const error = parseBillingError(42);

      expect(error).toEqual({
        type: 'unrecognized',
        original: 42,
      });
    });

    it('returns unrecognized for an array', () => {
      const error = parseBillingError([]);

      expect(error).toEqual({
        type: 'unrecognized',
        original: [],
      });
    });

    it('returns unrecognized for a boolean', () => {
      const error = parseBillingError(true);

      expect(error).toEqual({
        type: 'unrecognized',
        original: true,
      });
    });
  });

  describe('Non-billing errors', () => {
    it('returns unrecognized for a non-billing 400 error', () => {
      const error = parseBillingError({
        detail: 'Not found',
      });

      expect(error).toEqual({
        type: 'unrecognized',
        original: expect.any(Object),
      });
    });

    it('returns unrecognized for a generic Error-like object', () => {
      const error = parseBillingError({
        message: 'Network error',
        stack: 'Error: Network error\n    at ...',
      });

      expect(error).toEqual({
        type: 'unrecognized',
        original: expect.any(Object),
      });
    });

    it('returns unrecognized for an empty object', () => {
      const error = parseBillingError({});

      expect(error).toEqual({
        type: 'unrecognized',
        original: expect.any(Object),
      });
    });
  });
});

describe('isLimitExceeded', () => {
  it('returns true for a limit_exceeded error', () => {
    const error: BillingError = {
      code: 'limit_exceeded',
      resource: 'organization_members',
      current_usage: 5,
      limit: 10,
      remedy: 'upgrade_plan',
    };

    expect(isLimitExceeded(error)).toBe(true);
  });

  it('returns false for a coded billing error', () => {
    const error: BillingError = {
      code: 'payment_token_required',
      detail: 'A payment token is required',
    };

    expect(isLimitExceeded(error)).toBe(false);
  });

  it('returns false for a field validation error', () => {
    const error: BillingError = {
      type: 'field_validation',
      fields: { email: ['Required'] },
    };

    expect(isLimitExceeded(error)).toBe(false);
  });

  it('returns false for an unrecognized error', () => {
    const error: BillingError = {
      type: 'unrecognized',
      original: {},
    };

    expect(isLimitExceeded(error)).toBe(false);
  });
});

describe('isChargeDeclined', () => {
  it('returns true for a charge_declined error', () => {
    const error: BillingError = {
      code: 'charge_declined',
      detail: 'Card was declined',
    };

    expect(isChargeDeclined(error)).toBe(true);
  });

  it('returns false for a different coded error', () => {
    const error: BillingError = {
      code: 'payment_token_required',
      detail: 'A payment token is required',
    };

    expect(isChargeDeclined(error)).toBe(false);
  });

  it('returns false for a limit_exceeded error', () => {
    const error: BillingError = {
      code: 'limit_exceeded',
      resource: 'organization_members',
      current_usage: 5,
      limit: 10,
      remedy: 'upgrade_plan',
    };

    expect(isChargeDeclined(error)).toBe(false);
  });

  it('returns false for a field validation error', () => {
    const error: BillingError = {
      type: 'field_validation',
      fields: { email: ['Required'] },
    };

    expect(isChargeDeclined(error)).toBe(false);
  });

  it('returns false for an unrecognized error', () => {
    const error: BillingError = {
      type: 'unrecognized',
      original: {},
    };

    expect(isChargeDeclined(error)).toBe(false);
  });
});

describe('remedyOf', () => {
  it('returns the remedy for a limit_exceeded error', () => {
    const error: BillingError = {
      code: 'limit_exceeded',
      resource: 'organization_members',
      current_usage: 5,
      limit: 10,
      remedy: 'upgrade_plan',
    };

    expect(remedyOf(error)).toBe('upgrade_plan');
  });

  it('returns undefined for a coded billing error', () => {
    const error: BillingError = {
      code: 'payment_token_required',
      detail: 'A payment token is required',
    };

    expect(remedyOf(error)).toBe(undefined);
  });

  it('returns undefined for a field validation error', () => {
    const error: BillingError = {
      type: 'field_validation',
      fields: { email: ['Required'] },
    };

    expect(remedyOf(error)).toBe(undefined);
  });

  it('returns undefined for an unrecognized error', () => {
    const error: BillingError = {
      type: 'unrecognized',
      original: {},
    };

    expect(remedyOf(error)).toBe(undefined);
  });

  it('returns all four remedy types correctly', () => {
    const remedies = [
      'purchase_add_on',
      'upgrade_plan',
      'add_payment_method',
      'resolve_billing',
    ] as const;

    for (const remedy of remedies) {
      const error: BillingError = {
        code: 'limit_exceeded',
        resource: 'organization_members',
        current_usage: 5,
        limit: 10,
        remedy,
      };

      expect(remedyOf(error)).toBe(remedy);
    }
  });
});

describe('billingErrorMessage', () => {
  it('returns the detail for a coded billing error', () => {
    const error: BillingError = {
      code: 'payment_token_required',
      detail: 'A payment token is required',
    };

    expect(billingErrorMessage(error)).toBe('A payment token is required');
  });

  it('returns undefined for a limit_exceeded error (no detail field)', () => {
    const error: BillingError = {
      code: 'limit_exceeded',
      resource: 'organization_members',
      current_usage: 5,
      limit: 10,
      remedy: 'upgrade_plan',
    };

    expect(billingErrorMessage(error)).toBe(undefined);
  });

  it('returns undefined for a field validation error', () => {
    const error: BillingError = {
      type: 'field_validation',
      fields: { email: ['Required'] },
    };

    expect(billingErrorMessage(error)).toBe(undefined);
  });

  it('returns undefined for an unrecognized error', () => {
    const error: BillingError = {
      type: 'unrecognized',
      original: {},
    };

    expect(billingErrorMessage(error)).toBe(undefined);
  });
});
