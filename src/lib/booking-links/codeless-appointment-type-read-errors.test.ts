import { describe, expect, it } from 'vitest';
import {
  parseCodelessAppointmentTypeReadFailure,
  CodelessAppointmentTypeReadFailureError,
} from './codeless-appointment-type-read-errors';

function makeResponse(status: number, ok = status >= 200 && status < 300) {
  return { ok, status } as Response;
}

describe('parseCodelessAppointmentTypeReadFailure', () => {
  it('maps an unknown slug (404) to not-found, distinct from unavailable', () => {
    expect(parseCodelessAppointmentTypeReadFailure(makeResponse(404))).toBe(
      'not-found'
    );
  });

  it('maps a real but non-public (or duration-unset) appointment type (403) to unavailable', () => {
    expect(parseCodelessAppointmentTypeReadFailure(makeResponse(403))).toBe(
      'unavailable'
    );
  });

  it('keeps 404 and 403 as two distinct states — this is the whole point of this module', () => {
    const notFound = parseCodelessAppointmentTypeReadFailure(makeResponse(404));
    const unavailable = parseCodelessAppointmentTypeReadFailure(
      makeResponse(403)
    );
    expect(notFound).not.toBe(unavailable);
  });

  it('maps a malformed search window (400) to range-invalid', () => {
    expect(parseCodelessAppointmentTypeReadFailure(makeResponse(400))).toBe(
      'range-invalid'
    );
  });

  it('maps a 2xx response to ok', () => {
    expect(parseCodelessAppointmentTypeReadFailure(makeResponse(200))).toBe(
      'ok'
    );
  });

  it('maps anything else (5xx) to the generic error state', () => {
    expect(parseCodelessAppointmentTypeReadFailure(makeResponse(500))).toBe(
      'error'
    );
  });
});

describe('CodelessAppointmentTypeReadFailureError', () => {
  it('carries the state it was constructed with', () => {
    const err = new CodelessAppointmentTypeReadFailureError('not-found');
    expect(err.state).toBe('not-found');
    expect(err.name).toBe('CodelessAppointmentTypeReadFailureError');
  });
});
