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
 */

import { describe, it, expect } from 'vitest';
import { readOverLimitError, isNotFoundError } from './api-errors';

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
