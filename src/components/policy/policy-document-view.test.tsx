/**
 * PolicyDocumentView is an async Server Component (it awaits
 * `renderMarkdownToSafeHtml` internally). React Testing Library can't render
 * an async component function directly in jsdom the way it renders a normal
 * component — so per the documented pattern for testing RSCs, we invoke the
 * component function directly, await the resolved element, and render that
 * element.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PolicyDocument } from '@/client';
import { PolicyDocumentView } from './policy-document-view';

const samplePolicyDocument: PolicyDocument = {
  id: 1,
  document_type: 'privacy_policy',
  version: 2,
  title: 'Privacy Policy',
  body_markdown: '# Heading\n\nSome **body** text.',
  published_at: '2026-01-15T00:00:00Z',
};

describe('PolicyDocumentView', () => {
  it('renders a placeholder empty-state when document is null', async () => {
    render(await PolicyDocumentView({ document: null }));

    expect(screen.getByText(/nothing published yet/i)).toBeInTheDocument();
  });

  it('renders the title, version, and sanitized HTML body when document is present', async () => {
    render(await PolicyDocumentView({ document: samplePolicyDocument }));

    expect(
      screen.getByRole('heading', { name: 'Privacy Policy' })
    ).toBeInTheDocument();
    expect(screen.getByText(/version 2/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Heading', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('strips unsafe markup from the rendered body', async () => {
    const unsafeDocument: PolicyDocument = {
      ...samplePolicyDocument,
      body_markdown: 'Safe text<script>alert("xss")</script>',
    };

    const { container } = render(
      await PolicyDocumentView({ document: unsafeDocument })
    );

    expect(container.querySelector('script')).toBeNull();
  });
});
