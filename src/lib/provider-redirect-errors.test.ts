import { describe, it, expect } from 'vitest';
import { formatProviderRedirectError } from './provider-redirect-errors';

describe('formatProviderRedirectError', () => {
  it('extracts the first Django field error message', () => {
    expect(
      formatProviderRedirectError({ callback_url: ['Invalid URL.'] })
    ).toBe('Invalid URL.');
  });

  it('extracts the first allauth errors entry', () => {
    expect(
      formatProviderRedirectError({
        status: 400,
        errors: [{ code: 'invalid', message: 'Provider not enabled.' }],
      })
    ).toBe('Provider not enabled.');
  });

  it('returns a fallback for unknown payloads', () => {
    expect(formatProviderRedirectError(null)).toBe(
      'Could not start social sign-in. Please try again.'
    );
  });
});
