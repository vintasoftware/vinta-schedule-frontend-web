/**
 * TermsPage is an async Server Component (it awaits
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

import TermsPage from './page';

const sampleTermsOfUse: PolicyDocument = {
  id: 2,
  document_type: 'terms_of_use',
  version: 2,
  title: 'Terms of Use',
  body_markdown: 'By using our service, you agree to these **terms**.',
  published_at: '2026-02-01T00:00:00Z',
};

describe('TermsPage', () => {
  it('fetches the terms of use document and passes it to PolicyDocumentView', async () => {
    fetchLatestPolicyDocument.mockResolvedValueOnce(sampleTermsOfUse);

    render(await TermsPage());

    expect(fetchLatestPolicyDocument).toHaveBeenCalledWith('terms_of_use');
    expect(screen.getByTestId('policy-view')).toHaveTextContent('has-document');
  });

  it('passes a null document to PolicyDocumentView when none is published (404)', async () => {
    fetchLatestPolicyDocument.mockResolvedValueOnce(null);

    render(await TermsPage());

    expect(screen.getByTestId('policy-view')).toHaveTextContent('placeholder');
  });
});
