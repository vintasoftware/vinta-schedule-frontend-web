import { describe, expect, it } from 'vitest';
import {
  parseCodelessGroupReadFailure,
  CodelessGroupReadFailureError,
} from './codeless-group-read-errors';

function makeResponse(status: number, ok = status >= 200 && status < 300) {
  return { ok, status } as Response;
}

describe('parseCodelessGroupReadFailure', () => {
  it('maps an unknown slug (404) to not-found, distinct from unavailable', () => {
    expect(parseCodelessGroupReadFailure(makeResponse(404))).toBe('not-found');
  });

  it('maps a real but non-public (or duration-unset) group (403) to unavailable', () => {
    expect(parseCodelessGroupReadFailure(makeResponse(403))).toBe(
      'unavailable'
    );
  });

  it('keeps 404 and 403 as two distinct states — this is the whole point of this module', () => {
    const notFound = parseCodelessGroupReadFailure(makeResponse(404));
    const unavailable = parseCodelessGroupReadFailure(makeResponse(403));
    expect(notFound).not.toBe(unavailable);
  });

  it('maps a malformed search window (400) to range-invalid', () => {
    expect(parseCodelessGroupReadFailure(makeResponse(400))).toBe(
      'range-invalid'
    );
  });

  it('maps a 2xx response to ok', () => {
    expect(parseCodelessGroupReadFailure(makeResponse(200))).toBe('ok');
  });

  it('maps anything else (5xx) to the generic error state', () => {
    expect(parseCodelessGroupReadFailure(makeResponse(500))).toBe('error');
  });
});

describe('CodelessGroupReadFailureError', () => {
  it('carries the state it was constructed with', () => {
    const err = new CodelessGroupReadFailureError('not-found');
    expect(err.state).toBe('not-found');
    expect(err.name).toBe('CodelessGroupReadFailureError');
  });
});
