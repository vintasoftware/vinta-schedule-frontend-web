/**
 * api-errors tests.
 *
 * Covers:
 * - readOverLimitError reads a well-formed 402 body into its typed shape.
 * - readOverLimitError returns null for a body missing any of the five
 *   documented fields, for an unrelated 400 validation body, for a 500-style
 *   plain-text/Error rejection, and for null/undefined/non-object values.
 * - isNotFoundError matches the exact non-disclosure 404 body and nothing
 *   else — not a 402 body, not a 400 validation body, not a body whose
 *   `detail` merely contains "not found" as a substring.
 * - readNonFieldError reads the first message out of a DRF-style
 *   `non_field_errors` array, and returns null for anything else (an empty
 *   array, a differently shaped 400, a 500-style rejection, non-object
 *   values).
 */

import { describe, it, expect } from 'vitest';
import {
  readOverLimitError,
  isNotFoundError,
  readNonFieldError,
  readBillingConflict,
  isPaymentTokenRequiredError,
  isAddOnNotPurchasableError,
} from './api-errors';

describe('readOverLimitError', () => {
  it('reads a well-formed over-limit body into its typed shape', () => {
    const body = {
      code: 'limit_exceeded',
      resource: 'availability_windows',
      current_usage: 50,
      limit: 50,
      detail: 'Organization is at its limit for availability windows.',
      // Extra field some responses carry (e.g. the GraphQL batch mutation's
      // `remedy`) — present in the input but not asserted as part of the
      // typed shape below, to keep this test agnostic to fields the REST
      // write path may or may not send.
      remedy: 'purchase_add_on',
    };

    expect(readOverLimitError(body)).toEqual({
      code: 'limit_exceeded',
      resource: 'availability_windows',
      current_usage: 50,
      limit: 50,
      detail: 'Organization is at its limit for availability windows.',
    });
  });

  it('returns null when code is not limit_exceeded', () => {
    expect(
      readOverLimitError({
        code: 'something_else',
        resource: 'availability_windows',
        current_usage: 1,
        limit: 1,
        detail: 'x',
      })
    ).toBeNull();
  });

  it('returns null for an unrelated 400 validation body', () => {
    expect(
      readOverLimitError({
        start_time: ['start_time must be before end_time.'],
      })
    ).toBeNull();
  });

  it('returns null when a required field is missing', () => {
    expect(
      readOverLimitError({
        code: 'limit_exceeded',
        resource: 'availability_windows',
        // current_usage missing
        limit: 50,
        detail: 'x',
      })
    ).toBeNull();
  });

  it('returns null when a required field has the wrong type', () => {
    expect(
      readOverLimitError({
        code: 'limit_exceeded',
        resource: 'availability_windows',
        current_usage: '50', // string, not number
        limit: 50,
        detail: 'x',
      })
    ).toBeNull();
  });

  it('returns null for a plain-text/500-style rejection', () => {
    expect(readOverLimitError('Internal Server Error')).toBeNull();
    expect(readOverLimitError(new Error('boom'))).toBeNull();
  });

  it('returns null for null, undefined, and non-object values', () => {
    expect(readOverLimitError(null)).toBeNull();
    expect(readOverLimitError(undefined)).toBeNull();
    expect(readOverLimitError(42)).toBeNull();
  });
});

describe('isNotFoundError', () => {
  it('matches the exact non-disclosure 404 body', () => {
    expect(isNotFoundError({ detail: 'Not found.' })).toBe(true);
  });

  it('does not match a 402 over-limit body', () => {
    expect(
      isNotFoundError({
        code: 'limit_exceeded',
        resource: 'availability_windows',
        current_usage: 50,
        limit: 50,
        detail: 'Organization is at its limit for availability windows.',
      })
    ).toBe(false);
  });

  it('does not match a 400 validation body', () => {
    expect(
      isNotFoundError({ start_time: ['start_time must be before end_time.'] })
    ).toBe(false);
  });

  it('does not match a detail string that merely contains "not found"', () => {
    // Guards against substring matching -- only the exact documented body
    // counts as the non-disclosure 404.
    expect(
      isNotFoundError({ detail: 'Resource could not be found on server.' })
    ).toBe(false);
  });

  it('returns false for null, undefined, and non-object values', () => {
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError(undefined)).toBe(false);
    expect(isNotFoundError('Not found.')).toBe(false);
  });
});

describe('readNonFieldError', () => {
  it('reads the first message out of a well-formed non_field_errors body', () => {
    expect(
      readNonFieldError({
        non_field_errors: [
          'The fields calendar, group_slot, period must make a unique set.',
        ],
      })
    ).toBe('The fields calendar, group_slot, period must make a unique set.');
  });

  it('returns null for an empty non_field_errors array', () => {
    expect(readNonFieldError({ non_field_errors: [] })).toBeNull();
  });

  it('returns null when non_field_errors is not an array', () => {
    expect(readNonFieldError({ non_field_errors: 'not an array' })).toBeNull();
  });

  it('returns null for a differently shaped 400 (field-level errors)', () => {
    expect(readNonFieldError({ cap: ['Must be at least 1.'] })).toBeNull();
  });

  it('returns null for a 402 over-limit body', () => {
    expect(
      readNonFieldError({
        code: 'limit_exceeded',
        resource: 'availability_windows',
        current_usage: 50,
        limit: 50,
        detail: 'Organization is at its limit for availability windows.',
      })
    ).toBeNull();
  });

  it('returns null for a plain-text/500-style rejection', () => {
    expect(readNonFieldError('Internal Server Error')).toBeNull();
    expect(readNonFieldError(new Error('boom'))).toBeNull();
  });

  it('returns null for null, undefined, and non-object values', () => {
    expect(readNonFieldError(null)).toBeNull();
    expect(readNonFieldError(undefined)).toBeNull();
    expect(readNonFieldError(42)).toBeNull();
  });
});

describe('readBillingConflict', () => {
  it('reads a plan-change-in-flight 409 body into its typed shape', () => {
    expect(
      readBillingConflict({
        detail: 'a plan change is already awaiting confirmation',
      })
    ).toEqual({ detail: 'a plan change is already awaiting confirmation' });
  });

  it('reads a provider-unconfigured 409 body', () => {
    expect(readBillingConflict({ detail: 'provider not configured' })).toEqual({
      detail: 'provider not configured',
    });
  });

  it('returns null for a 402 over-limit body (also carries detail)', () => {
    expect(
      readBillingConflict({
        code: 'limit_exceeded',
        resource: 'availability_windows',
        current_usage: 50,
        limit: 50,
        detail: 'Organization is at its limit for availability windows.',
      })
    ).toBeNull();
  });

  it('returns null for a DRF field-error 400', () => {
    expect(readBillingConflict({ cap: ['Must be at least 1.'] })).toBeNull();
  });

  it('returns null when detail is not a string', () => {
    expect(readBillingConflict({ detail: 42 })).toBeNull();
    expect(readBillingConflict({ detail: ['x'] })).toBeNull();
  });

  it('returns null for a plain-text/500-style rejection', () => {
    expect(readBillingConflict('Internal Server Error')).toBeNull();
    expect(readBillingConflict(new Error('boom'))).toBeNull();
  });

  it('returns null for null, undefined, and non-object values', () => {
    expect(readBillingConflict(null)).toBeNull();
    expect(readBillingConflict(undefined)).toBeNull();
    expect(readBillingConflict(42)).toBeNull();
  });
});

describe('isPaymentTokenRequiredError', () => {
  it('matches a code discriminator', () => {
    expect(
      isPaymentTokenRequiredError({ code: 'payment_token_required' })
    ).toBe(true);
    expect(
      isPaymentTokenRequiredError({ code: 'payment_token_required_error' })
    ).toBe(true);
  });

  it('matches a detail/message mentioning a required payment token or method', () => {
    expect(
      isPaymentTokenRequiredError({ detail: 'A payment token is required.' })
    ).toBe(true);
    expect(
      isPaymentTokenRequiredError({
        message: 'Please provide a payment method.',
      })
    ).toBe(true);
    expect(
      isPaymentTokenRequiredError({ detail: 'payment_token must be supplied' })
    ).toBe(true);
  });

  it('does not misread a 402 over-limit body', () => {
    expect(
      isPaymentTokenRequiredError({
        code: 'limit_exceeded',
        resource: 'organization_members',
        current_usage: 10,
        limit: 5,
        detail: 'over limit',
      })
    ).toBe(false);
  });

  it('does not misread an unrelated 409 conflict', () => {
    expect(
      isPaymentTokenRequiredError({
        detail: 'A plan change is already awaiting confirmation.',
      })
    ).toBe(false);
  });

  it('does not misread a 409 that merely mentions a payment method', () => {
    // The substring fallback must not classify a body that only mentions a
    // "payment method" without asserting a token is required/missing — this is
    // a conflict body, checked before readBillingConflict.
    expect(
      isPaymentTokenRequiredError({
        detail: 'A payment method change is already processing.',
      })
    ).toBe(false);
  });

  it('returns false for null / non-object / error values', () => {
    expect(isPaymentTokenRequiredError(null)).toBe(false);
    expect(isPaymentTokenRequiredError(undefined)).toBe(false);
    expect(isPaymentTokenRequiredError('payment token')).toBe(false);
    expect(isPaymentTokenRequiredError(new Error('payment token'))).toBe(false);
  });
});

describe('isAddOnNotPurchasableError', () => {
  it('matches a code discriminator', () => {
    expect(isAddOnNotPurchasableError({ code: 'add_on_not_purchasable' })).toBe(
      true
    );
    expect(
      isAddOnNotPurchasableError({ code: 'add_on_not_purchasable_error' })
    ).toBe(true);
  });

  it('matches a detail/message asserting the resource is not purchasable', () => {
    expect(
      isAddOnNotPurchasableError({
        detail: 'This resource is not purchasable as an add-on.',
      })
    ).toBe(true);
    expect(
      isAddOnNotPurchasableError({
        message: "Calendar groups can't be purchased as an add-on.",
      })
    ).toBe(true);
  });

  it('does not match a bare add-on mention without a not-purchasable assertion', () => {
    // A 409 conflict mentioning an add-on is NOT this 400.
    expect(
      isAddOnNotPurchasableError({
        detail: 'An add-on purchase is already processing.',
      })
    ).toBe(false);
  });

  it('excludes the 402 over-limit body', () => {
    expect(
      isAddOnNotPurchasableError({
        code: 'limit_exceeded',
        detail: 'not purchasable add-on',
      })
    ).toBe(false);
  });

  it('returns false for a non-object, a plain string, or an Error', () => {
    expect(isAddOnNotPurchasableError(null)).toBe(false);
    expect(isAddOnNotPurchasableError(undefined)).toBe(false);
    expect(isAddOnNotPurchasableError('add-on not purchasable')).toBe(false);
    expect(
      isAddOnNotPurchasableError(new Error('add-on not purchasable'))
    ).toBe(false);
  });
});
