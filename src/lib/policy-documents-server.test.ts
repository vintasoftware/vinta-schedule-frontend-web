import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLatestPolicyDocument } from './policy-documents-server';
import type { PolicyDocument } from '@/client';

describe('fetchLatestPolicyDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(response: Partial<Response & { ok: boolean }>) {
    global.fetch = vi.fn().mockResolvedValue(response);
  }

  function jsonFetch(status: number, body: unknown) {
    mockFetch({
      ok: status >= 200 && status < 300,
      json: async () => body,
    } as Response);
  }

  const samplePolicyDocument: PolicyDocument = {
    id: 1,
    document_type: 'privacy_policy',
    version: 3,
    title: 'Privacy Policy',
    body_markdown: '# Privacy Policy\n\nWe respect your data.',
    published_at: '2026-01-01T00:00:00Z',
  };

  it('returns the parsed PolicyDocument on a 200 response', async () => {
    jsonFetch(200, samplePolicyDocument);

    const result = await fetchLatestPolicyDocument('privacy_policy');
    expect(result).toEqual(samplePolicyDocument);
  });

  it('requests the correct public endpoint for the given document type', async () => {
    jsonFetch(200, samplePolicyDocument);
    const fetchSpy = vi.spyOn(global, 'fetch');

    await fetchLatestPolicyDocument('terms_of_use');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/policy-documents/latest/terms_of_use/'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns null on a 404 response', async () => {
    mockFetch({ ok: false, json: async () => ({}) } as Response);

    const result = await fetchLatestPolicyDocument('privacy_policy');
    expect(result).toBeNull();
  });

  it('returns null on a non-404 non-2xx response', async () => {
    mockFetch({ ok: false, json: async () => ({}) } as Response);

    const result = await fetchLatestPolicyDocument('sms_consent');
    expect(result).toBeNull();
  });

  it('returns null on a network error — never throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchLatestPolicyDocument('privacy_policy');
    expect(result).toBeNull();
  });

  it('returns null on a fetch timeout / abort — never throws', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(
        new DOMException('The operation was aborted.', 'AbortError')
      );

    const result = await fetchLatestPolicyDocument('privacy_policy');
    expect(result).toBeNull();
  });

  it('returns null on a JSON parse failure — never throws', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    } as unknown as Response);

    const result = await fetchLatestPolicyDocument('privacy_policy');
    expect(result).toBeNull();
  });

  it('returns null when the response body is null', async () => {
    jsonFetch(200, null);

    const result = await fetchLatestPolicyDocument('privacy_policy');
    expect(result).toBeNull();
  });
});
