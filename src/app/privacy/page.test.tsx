/**
 * PrivacyPage is an async Server Component (it awaits
 * `fetchLatestPolicyDocument` internally), so we invoke the component
 * function directly and await the resolved element before rendering it —
 * React Testing Library can't render an async component function directly
 * in jsdom.
 *
 * `PolicyDocumentView` is mocked to a sync stub because its own rendering
 * (title/version/sanitized body/placeholder) is covered by its own tests;
 * this test only verifies the page fetches the right document type and
 * wires the result to the child.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PolicyDocument } from '@/client';

const fetchLatestPolicyDocument = vi.fn();
vi.mock('@/lib/policy-documents-server', () => ({
  fetchLatestPolicyDocument: (...args: unknown[]) =>
    fetchLatestPolicyDocument(...args),
}));

vi.mock('@/components/policy/policy-document-view', () => ({
  PolicyDocumentView: ({ document }: { document: unknown }) => (
    <div data-testid='policy-view'>
      {document ? 'has-document' : 'placeholder'}
    </div>
  ),
}));

import PrivacyPage from './page';

const samplePrivacyPolicy: PolicyDocument = {
  id: 1,
  document_type: 'privacy_policy',
  version: 3,
  title: 'Privacy Policy',
  body_markdown: 'We respect your **privacy**.',
  published_at: '2026-02-01T00:00:00Z',
};

describe('PrivacyPage', () => {
  it('fetches the privacy policy document and passes it to PolicyDocumentView', async () => {
    fetchLatestPolicyDocument.mockResolvedValueOnce(samplePrivacyPolicy);

    render(await PrivacyPage());

    expect(fetchLatestPolicyDocument).toHaveBeenCalledWith('privacy_policy');
    expect(screen.getByTestId('policy-view')).toHaveTextContent('has-document');
  });

  it('passes a null document to PolicyDocumentView when none is published (404)', async () => {
    fetchLatestPolicyDocument.mockResolvedValueOnce(null);

    render(await PrivacyPage());

    expect(screen.getByTestId('policy-view')).toHaveTextContent('placeholder');
  });
});
