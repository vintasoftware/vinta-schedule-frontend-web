import type { Metadata } from 'next';
import Link from 'next/link';

import { Heading, Stack, Text } from 'vinta-schedule-design-system/layout';
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { DOCS_NAV, type DocsNavSection } from '@/lib/docs/nav';

export const metadata: Metadata = {
  title: 'Overview',
};

const SECTION_DESCRIPTIONS: Record<DocsNavSection['slug'], string> = {
  'getting-started':
    'Mint a public API token and send your first authenticated GraphQL request.',
  reference: 'Every query, mutation, and type in the public GraphQL schema.',
  concepts:
    'How Calendar Groups, Events, Availability, and Bundles fit together.',
  webhooks: 'The outbound event catalog and the webhook configuration types.',
  explorer: 'A live GraphiQL console to try requests against /graphql/.',
};

/**
 * Public docs landing page. No real content yet — Phase 0 scaffold. The
 * section list is driven by `DOCS_NAV` so this page can never drift from the
 * sidebar; later phases replace the destinations, not this page's structure.
 */
export default function DocsPage() {
  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Heading level={1}>Vinta Schedule API Docs</Heading>
        <Text color='muted-foreground'>
          Everything you need to call the public Vinta Schedule GraphQL API —
          from your first authenticated request to the full schema reference.
        </Text>
      </Stack>

      <List variant='plain' gap={4}>
        {DOCS_NAV.map((section) => (
          <ListItem key={section.slug}>
            <Stack gap={1}>
              <TextLink asChild size='lg'>
                <Link href={section.href}>{section.title}</Link>
              </TextLink>
              <Text size='sm' color='muted-foreground'>
                {SECTION_DESCRIPTIONS[section.slug]}
              </Text>
            </Stack>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}
