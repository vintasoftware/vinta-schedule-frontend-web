/**
 * api-errors tests.
 *
 * Covers Phase 1 (billing hardening):
 * - readBillingErrorCode extracts and narrows to the ten recognized codes.
 * - All ten billing error codes have working readers (code-only, no fallback).
 * - The substring-fallback readers (isPaymentTokenRequiredError, isAddOnNotPurchasableError)
 *   now branch only on code; a mismatched detail is not misclassified.
 * - readFieldValidationErrors reads a field-keyed error map and rejects
 *   billing errors / non-field-errors / non-object values.
 * - readOverLimitError still exposes `resource` for remedy derivation.
 *
 * Also covers existing readers:
 * - isNotFoundError matches the exact non-disclosure 404 body.
 * - readNonFieldError reads DRF non-field-errors.
 */

import { describe, it, expect } from 'vitest';
import {
  readOverLimitError,
  isNotFoundError,
  readNonFieldError,
  readBillingConflict,
  isPaymentTokenRequiredError,
  isAddOnNotPurchasableError,
  isChargeDeclinedError,
  isUnconfirmedPlanChangeError,
  isPaymentProviderNotConfiguredError,
  isRetryPaymentNotApplicableError,
  isSubscriptionNotAttachedError,
  isNoOutstandingBalanceError,
  isCollectionNotSupportedError,
  readBillingErrorCode,
  readFieldValidationErrors,
  billingUpgradePath,
  getApiErrorMessage,
  humanizeFieldName,
  GENERIC_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
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

describe('billingUpgradePath', () => {
  it('maps to the plan picker carrying the resource as a query param', () => {
    expect(billingUpgradePath('availability_windows')).toBe(
      '/billing/plans?resource=availability_windows'
    );
  });

  it('returns the bare plan picker when no resource is given', () => {
    expect(billingUpgradePath()).toBe('/billing/plans');
    expect(billingUpgradePath(undefined)).toBe('/billing/plans');
  });

  it('url-encodes a resource with unsafe characters', () => {
    expect(billingUpgradePath('a resource/with&chars')).toBe(
      '/billing/plans?resource=a%20resource%2Fwith%26chars'
    );
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
          'The fields calendar, appointment_type_slot, period must make a unique set.',
        ],
      })
    ).toBe(
      'The fields calendar, appointment_type_slot, period must make a unique set.'
    );
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

describe('isAddOnNotPurchasableError', () => {
  it('matches the code discriminator', () => {
    expect(isAddOnNotPurchasableError({ code: 'add_on_not_purchasable' })).toBe(
      true
    );
  });

  it('returns false when code is not add_on_not_purchasable', () => {
    // This is the key regression test: a detail that LOOKS like it matches
    // the old substring logic but has a different code must return false.
    expect(
      isAddOnNotPurchasableError({
        code: 'some_other_error',
        detail: 'This resource is not purchasable as an add-on.',
      })
    ).toBe(false);
  });

  it('does not match the old fallback-code variants', () => {
    // The hardened contract uses the non-suffixed code; _error variants
    // are removed from the hardened spec.
    expect(
      isAddOnNotPurchasableError({ code: 'add_on_not_purchasable_error' })
    ).toBe(false);
  });

  it('excludes the 402 over-limit body', () => {
    expect(
      isAddOnNotPurchasableError({
        code: 'limit_exceeded',
        detail: 'not purchasable',
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

describe('isPaymentTokenRequiredError', () => {
  it('matches the code discriminator', () => {
    expect(
      isPaymentTokenRequiredError({ code: 'payment_token_required' })
    ).toBe(true);
  });

  it('returns false when code is not payment_token_required', () => {
    // Key regression test: a detail mentioning "required" but with a different code.
    expect(
      isPaymentTokenRequiredError({
        code: 'some_other_error',
        detail: 'A payment token is required.',
      })
    ).toBe(false);
  });

  it('does not match the old fallback-code variants', () => {
    expect(
      isPaymentTokenRequiredError({ code: 'payment_token_required_error' })
    ).toBe(false);
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

  it('returns false for null / non-object / error values', () => {
    expect(isPaymentTokenRequiredError(null)).toBe(false);
    expect(isPaymentTokenRequiredError(undefined)).toBe(false);
    expect(isPaymentTokenRequiredError('payment token required')).toBe(false);
    expect(isPaymentTokenRequiredError(new Error('payment token'))).toBe(false);
  });
});

describe('isChargeDeclinedError', () => {
  it('matches the code discriminator', () => {
    expect(isChargeDeclinedError({ code: 'charge_declined' })).toBe(true);
  });

  it('returns false for a different code (including limit_exceeded)', () => {
    expect(
      isChargeDeclinedError({
        code: 'limit_exceeded',
        resource: 'availability_windows',
        current_usage: 1,
        limit: 1,
        detail: 'x',
      })
    ).toBe(false);
  });

  it('returns false for a non-object or Error', () => {
    expect(isChargeDeclinedError(null)).toBe(false);
    expect(isChargeDeclinedError(undefined)).toBe(false);
    expect(isChargeDeclinedError('charge declined')).toBe(false);
    expect(isChargeDeclinedError(new Error('card declined'))).toBe(false);
  });
});

describe('isUnconfirmedPlanChangeError', () => {
  it('matches the code discriminator', () => {
    expect(
      isUnconfirmedPlanChangeError({ code: 'unconfirmed_plan_change' })
    ).toBe(true);
  });

  it('returns false for a different code', () => {
    expect(isUnconfirmedPlanChangeError({ code: 'some_other_code' })).toBe(
      false
    );
  });

  it('returns false for a non-object', () => {
    expect(isUnconfirmedPlanChangeError(null)).toBe(false);
    expect(isUnconfirmedPlanChangeError(undefined)).toBe(false);
  });
});

describe('isPaymentProviderNotConfiguredError', () => {
  it('matches the code discriminator', () => {
    expect(
      isPaymentProviderNotConfiguredError({
        code: 'payment_provider_not_configured',
      })
    ).toBe(true);
  });

  it('returns false for a different code', () => {
    expect(
      isPaymentProviderNotConfiguredError({ code: 'some_other_code' })
    ).toBe(false);
  });

  it('returns false for a non-object', () => {
    expect(isPaymentProviderNotConfiguredError(null)).toBe(false);
  });
});

describe('isRetryPaymentNotApplicableError', () => {
  it('matches the code discriminator', () => {
    expect(
      isRetryPaymentNotApplicableError({ code: 'retry_payment_not_applicable' })
    ).toBe(true);
  });

  it('returns false for a different code', () => {
    expect(isRetryPaymentNotApplicableError({ code: 'some_other_code' })).toBe(
      false
    );
  });

  it('returns false for a non-object', () => {
    expect(isRetryPaymentNotApplicableError(null)).toBe(false);
  });
});

describe('isSubscriptionNotAttachedError', () => {
  it('matches the code discriminator', () => {
    expect(
      isSubscriptionNotAttachedError({ code: 'subscription_not_attached' })
    ).toBe(true);
  });

  it('returns false for a different code', () => {
    expect(isSubscriptionNotAttachedError({ code: 'some_other_code' })).toBe(
      false
    );
  });

  it('returns false for a non-object', () => {
    expect(isSubscriptionNotAttachedError(null)).toBe(false);
  });
});

describe('isNoOutstandingBalanceError', () => {
  it('matches the code discriminator', () => {
    expect(
      isNoOutstandingBalanceError({ code: 'no_outstanding_balance' })
    ).toBe(true);
  });

  it('returns false for a different code', () => {
    expect(isNoOutstandingBalanceError({ code: 'some_other_code' })).toBe(
      false
    );
  });

  it('returns false for a non-object', () => {
    expect(isNoOutstandingBalanceError(null)).toBe(false);
  });
});

describe('isCollectionNotSupportedError', () => {
  it('matches the code discriminator', () => {
    expect(
      isCollectionNotSupportedError({ code: 'collection_not_supported' })
    ).toBe(true);
  });

  it('returns false for a different code', () => {
    expect(isCollectionNotSupportedError({ code: 'some_other_code' })).toBe(
      false
    );
  });

  it('returns false for a non-object', () => {
    expect(isCollectionNotSupportedError(null)).toBe(false);
  });
});

describe('readBillingErrorCode', () => {
  it('reads all ten recognized billing error codes', () => {
    expect(readBillingErrorCode({ code: 'limit_exceeded' })).toBe(
      'limit_exceeded'
    );
    expect(readBillingErrorCode({ code: 'charge_declined' })).toBe(
      'charge_declined'
    );
    expect(readBillingErrorCode({ code: 'payment_token_required' })).toBe(
      'payment_token_required'
    );
    expect(readBillingErrorCode({ code: 'unconfirmed_plan_change' })).toBe(
      'unconfirmed_plan_change'
    );
    expect(
      readBillingErrorCode({ code: 'payment_provider_not_configured' })
    ).toBe('payment_provider_not_configured');
    expect(readBillingErrorCode({ code: 'add_on_not_purchasable' })).toBe(
      'add_on_not_purchasable'
    );
    expect(readBillingErrorCode({ code: 'retry_payment_not_applicable' })).toBe(
      'retry_payment_not_applicable'
    );
    expect(readBillingErrorCode({ code: 'subscription_not_attached' })).toBe(
      'subscription_not_attached'
    );
    expect(readBillingErrorCode({ code: 'no_outstanding_balance' })).toBe(
      'no_outstanding_balance'
    );
    expect(readBillingErrorCode({ code: 'collection_not_supported' })).toBe(
      'collection_not_supported'
    );
  });

  it('returns null for an unknown code', () => {
    expect(readBillingErrorCode({ code: 'unknown_code' })).toBeNull();
  });

  it('returns null for a non-object', () => {
    expect(readBillingErrorCode(null)).toBeNull();
    expect(readBillingErrorCode(undefined)).toBeNull();
    expect(readBillingErrorCode('limit_exceeded')).toBeNull();
  });

  it('returns null when code field is missing', () => {
    expect(readBillingErrorCode({ detail: 'some error' })).toBeNull();
  });
});

describe('readFieldValidationErrors', () => {
  it('reads a field-keyed error map with string[] values', () => {
    expect(
      readFieldValidationErrors({
        email: ['Invalid email address.'],
        name: ['This field is required.'],
      })
    ).toEqual({
      email: 'Invalid email address.',
      name: 'This field is required.',
    });
  });

  it('takes the first message when a field has multiple errors', () => {
    expect(
      readFieldValidationErrors({
        email: ['Invalid email address.', 'Email is already in use.'],
      })
    ).toEqual({
      email: 'Invalid email address.',
    });
  });

  it('returns null for a billing error (has a code field)', () => {
    expect(
      readFieldValidationErrors({
        code: 'payment_token_required',
        detail: 'A payment token is required.',
      })
    ).toBeNull();
  });

  it('returns null for a non-field-errors 400', () => {
    expect(
      readFieldValidationErrors({
        non_field_errors: ['A constraint violation.'],
      })
    ).toBeNull();
  });

  it('returns null when no valid field errors are found', () => {
    expect(
      readFieldValidationErrors({ some_field: 'not an array' })
    ).toBeNull();
  });

  it('returns null when all field error arrays are empty', () => {
    expect(
      readFieldValidationErrors({
        email: [],
        name: [],
      })
    ).toBeNull();
  });

  it('ignores fields with non-string values in the array', () => {
    expect(
      readFieldValidationErrors({
        email: ['Invalid email.'],
        age: [123], // non-string, ignored
      })
    ).toEqual({
      email: 'Invalid email.',
    });
  });

  it('returns null for a non-object', () => {
    expect(readFieldValidationErrors(null)).toBeNull();
    expect(readFieldValidationErrors(undefined)).toBeNull();
    expect(readFieldValidationErrors('not an object')).toBeNull();
  });

  it('returns null for an Error instance', () => {
    expect(readFieldValidationErrors(new Error('boom'))).toBeNull();
  });

  it('returns null for a 402 over-limit body', () => {
    expect(
      readFieldValidationErrors({
        code: 'limit_exceeded',
        resource: 'availability_windows',
        current_usage: 50,
        limit: 50,
        detail: 'Organization is at its limit.',
      })
    ).toBeNull();
  });

  it('reads nested field errors (from nested serializers) with dotted keys', () => {
    expect(
      readFieldValidationErrors({
        billing_address: {
          street_name: ['This field is required.'],
          city: ['Invalid city.'],
        },
      })
    ).toEqual({
      'billing_address.street_name': 'This field is required.',
      'billing_address.city': 'Invalid city.',
    });
  });

  it('returns null for a nested field error combined with a billing code', () => {
    expect(
      readFieldValidationErrors({
        code: 'payment_token_required',
        billing_address: {
          street_name: ['This field is required.'],
        },
      })
    ).toBeNull();
  });
});

describe('getApiErrorMessage', () => {
  it('prefers a DRF detail over anything else', () => {
    expect(
      getApiErrorMessage({ detail: 'Not allowed.', name: ['Required.'] })
    ).toBe('Not allowed.');
  });

  it('reads non_field_errors when there is no detail', () => {
    expect(getApiErrorMessage({ non_field_errors: ['Already exists.'] })).toBe(
      'Already exists.'
    );
  });

  it('labels field errors when they are all that is available', () => {
    expect(
      getApiErrorMessage({ street_name: ['This field is required.'] })
    ).toBe('Street name: This field is required.');
  });

  it('reads a billing error detail that sits alongside a code', () => {
    expect(
      getApiErrorMessage({ code: 'charge_declined', detail: 'Card declined.' })
    ).toBe('Card declined.');
  });

  it('reports a transport failure as a connectivity problem', () => {
    expect(getApiErrorMessage(new TypeError('Failed to fetch'))).toBe(
      NETWORK_ERROR_MESSAGE
    );
  });

  it('passes through a plain-text error body', () => {
    expect(getApiErrorMessage('Service unavailable')).toBe(
      'Service unavailable'
    );
  });

  it('drops an HTML error page in favour of the fallback', () => {
    expect(
      getApiErrorMessage(
        '<!DOCTYPE html><html><body>Server Error</body></html>'
      )
    ).toBe(GENERIC_ERROR_MESSAGE);
  });

  it('falls back when the body carries nothing readable', () => {
    expect(getApiErrorMessage({ unexpected: 1 }, 'Could not save.')).toBe(
      'Could not save.'
    );
    expect(getApiErrorMessage(null, 'Could not save.')).toBe('Could not save.');
  });
});

describe('humanizeFieldName', () => {
  it('turns a serializer field name into a label', () => {
    expect(humanizeFieldName('street_name')).toBe('Street name');
  });

  it('labels a nested path by its last segment', () => {
    expect(humanizeFieldName('billing_address.street_name')).toBe(
      'Street name'
    );
  });
});
