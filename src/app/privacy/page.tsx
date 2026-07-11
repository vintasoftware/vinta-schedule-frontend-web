import type { Metadata } from 'next';

import { Container, Section } from '@vinta-schedule/design-system/layout';
import { PolicyDocumentView } from '@/components/policy/policy-document-view';
import { fetchLatestPolicyDocument } from '@/lib/policy-documents-server';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

/**
 * Public Privacy Policy page — no auth wrapper. Must render before a session
 * exists (e.g. linked from the signup consent checkboxes).
 *
 * `fetchLatestPolicyDocument` never throws and returns `null` on 404/error,
 * so `PolicyDocumentView` degrades to a placeholder instead of an error page.
 */
export default async function PrivacyPage() {
  const document = await fetchLatestPolicyDocument('privacy_policy');

  return (
    <Section>
      <Container width='prose'>
        <PolicyDocumentView document={document} />
      </Container>
    </Section>
  );
}
