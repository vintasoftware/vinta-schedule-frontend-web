import { DateTime } from 'luxon';

import type { PolicyDocument } from '@/client';
import { Box, Heading, Stack, Text } from 'vinta-schedule-design-system/layout';
import { renderMarkdownToSafeHtml } from '@/lib/render-markdown';

export interface PolicyDocumentViewProps {
  /** The latest published policy document, or `null` when none is published. */
  document: PolicyDocument | null;
}

/**
 * Renders a published policy document's markdown as sanitized HTML.
 *
 * Server component — the sanitized HTML is produced by
 * `renderMarkdownToSafeHtml` (server-only) before this component ever emits
 * anything to the client, so `dangerouslySetInnerHTML` here is safe: the
 * string it receives has already been through `rehype-sanitize`.
 *
 * Renders a placeholder empty-state when `document` is `null` (e.g. the
 * backend returned 404 because nothing has been published yet).
 */
export async function PolicyDocumentView({
  document,
}: PolicyDocumentViewProps) {
  if (!document) {
    return (
      <Stack gap={4} className='py-12 text-center'>
        <Heading level={1}>Nothing published yet</Heading>
        <Text color='muted-foreground'>
          This document hasn&apos;t been published yet. Please check back later.
        </Text>
      </Stack>
    );
  }

  const html = await renderMarkdownToSafeHtml(document.body_markdown);
  const publishedAt = DateTime.fromISO(document.published_at);

  return (
    <Stack gap={2}>
      <Heading level={1}>{document.title}</Heading>
      <Text color='muted-foreground' size='sm'>
        Version {document.version}
        {publishedAt.isValid
          ? ` · Last updated ${publishedAt.toLocaleString(DateTime.DATE_MED)}`
          : null}
      </Text>
      <Box
        className='[&_a]:text-primary mt-4 [&_a]:underline [&_a]:underline-offset-2 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:py-1 [&_p]:py-1 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:py-1'
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Stack>
  );
}
