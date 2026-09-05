import { describe, it, expect } from 'vitest';
import { parseReadFailure, parseWriteFailure } from './errors';

function fakeResponse(status: number, statusText = ''): Response {
  return new Response(null, { status, statusText });
}

describe('parseReadFailure', () => {
  it('maps 403 to the opaque link-invalid state, regardless of detail', () => {
    expect(parseReadFailure(fakeResponse(403))).toBe('link-invalid');
  });

  it('maps every 403 to link-invalid, proving the parser does not branch on the body', () => {
    // Each response carries a genuinely distinct `detail` body — the
    // assertion is that `parseReadFailure` collapses all of them to the same
    // opaque state anyway, because it takes only the `Response` and never
    // reads `detail`.
    const invalidCode = new Response(
      JSON.stringify({ detail: 'Invalid or expired code.' }),
      { status: 403 }
    );
    const expiredCode = new Response(
      JSON.stringify({ detail: 'This booking code has expired.' }),
      { status: 403 }
    );
    const usedCode = new Response(
      JSON.stringify({ detail: 'This booking code has already been used.' }),
      { status: 403 }
    );
    const revokedCode = new Response(
      JSON.stringify({ detail: 'This booking code has been revoked.' }),
      { status: 403 }
    );

    expect(parseReadFailure(invalidCode)).toBe('link-invalid');
    expect(parseReadFailure(expiredCode)).toBe('link-invalid');
    expect(parseReadFailure(usedCode)).toBe('link-invalid');
    expect(parseReadFailure(revokedCode)).toBe('link-invalid');
  });

  it('maps 400 to range-invalid', () => {
    expect(parseReadFailure(fakeResponse(400))).toBe('range-invalid');
  });

  it('maps other error statuses to error', () => {
    expect(parseReadFailure(fakeResponse(500))).toBe('error');
    expect(parseReadFailure(fakeResponse(404))).toBe('error');
  });

  it('maps a successful response to ok', () => {
    expect(parseReadFailure(fakeResponse(200))).toBe('ok');
  });
});

describe('parseWriteFailure', () => {
  it.each([
    ['INVALID_CODE', 404],
    ['NOT_PERMITTED', 403],
    ['REVOKED', 403],
    ['EXPIRED', 410],
    ['ALREADY_USED', 409],
    ['SLOT_UNAVAILABLE', 409],
  ] as const)(
    'maps %s (%d) to the matching error code',
    (errorCode, status) => {
      const response = fakeResponse(status);
      const body = { error_code: errorCode, detail: `${errorCode} happened` };

      const failure = parseWriteFailure(response, body);

      expect(failure.errorCode).toBe(errorCode);
      expect(failure.detail).toBe(`${errorCode} happened`);
    }
  );

  it('marks SLOT_UNAVAILABLE as the only retryable failure', () => {
    const retryable = parseWriteFailure(fakeResponse(409), {
      error_code: 'SLOT_UNAVAILABLE',
      detail: 'Slot no longer available',
    });
    expect(retryable.isRetryable).toBe(true);

    const nonRetryableCodes = [
      'INVALID_CODE',
      'NOT_PERMITTED',
      'REVOKED',
      'EXPIRED',
      'ALREADY_USED',
    ] as const;

    for (const errorCode of nonRetryableCodes) {
      const failure = parseWriteFailure(fakeResponse(409), {
        error_code: errorCode,
        detail: 'irrelevant',
      });
      expect(failure.isRetryable).toBe(false);
    }
  });

  it('falls back to a null error code and the response statusText for an unrecognized body', () => {
    const failure = parseWriteFailure(
      fakeResponse(500, 'Internal Server Error'),
      {}
    );
    expect(failure.errorCode).toBeNull();
    expect(failure.detail).toBe('Internal Server Error');
    expect(failure.isRetryable).toBe(false);
  });

  it('ignores an unrecognized error_code value rather than trusting it blindly', () => {
    const failure = parseWriteFailure(fakeResponse(400), {
      error_code: 'SOMETHING_NEW',
      detail: 'unexpected',
    });
    expect(failure.errorCode).toBeNull();
    expect(failure.detail).toBe('unexpected');
    expect(failure.isRetryable).toBe(false);
  });
});
