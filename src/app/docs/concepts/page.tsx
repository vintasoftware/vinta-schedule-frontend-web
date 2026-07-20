import type { Metadata } from 'next';
import Link from 'next/link';

import { Heading, Stack, Text } from 'vinta-schedule-design-system/layout';
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { DocsContainer } from '@/components/docs/docs-container';
import { getConcepts } from '@/lib/docs/fetch-concepts';

export const metadata: Metadata = {
  title: 'Concepts',
  description:
    'How Calendar Groups, Events, Availability, and Bundles fit together.',
};

/**
 * Concepts index — the top-level "Concepts" nav item's destination. Without
 * this page the sidebar's own top-level link (as opposed to its generated
 * per-doc children, which land on `/docs/concepts/<slug>` directly) would
 * 404. List is driven by the same `getConcepts()` fetch/snapshot source the
 * per-doc pages use, so it can never list a doc that doesn't actually
 * render.
 */
export default async function ConceptsIndexPage() {
  const { docs } = await getConcepts();

  return (
    <DocsContainer>
      <Stack gap={6}>
        <Stack gap={2}>
          <Heading level={1}>Concepts</Heading>
          <Text color='muted-foreground'>
            Domain guides ported from the backend — how Calendar Groups, Events,
            Availability, Recurrence, Bundles, and Calendars fit together.
          </Text>
        </Stack>

        <List variant='plain' gap={4}>
          {docs.map((doc) => (
            <ListItem key={doc.slug}>
              <TextLink asChild size='lg'>
                <Link href={`/docs/concepts/${doc.slug}`}>{doc.title}</Link>
              </TextLink>
            </ListItem>
          ))}
        </List>
      </Stack>
    </DocsContainer>
  );
}
