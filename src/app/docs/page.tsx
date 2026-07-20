import type { Metadata } from 'next';
import Link from 'next/link';

import { Heading, Stack, Text } from 'vinta-schedule-design-system/layout';
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { DocsContainer } from '@/components/docs/docs-container';
import { DOCS_NAV } from '@/lib/docs/nav';

export const metadata: Metadata = {
  title: 'Overview',
};

/**
 * Public docs landing page. No real content yet — Phase 0 scaffold. The
 * section list is driven by `DOCS_NAV` so this page can never drift from the
 * sidebar; later phases replace the destinations, not this page's structure.
 */
export default function DocsPage() {
  return (
    <DocsContainer>
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
                  {section.description}
                </Text>
              </Stack>
            </ListItem>
          ))}
        </List>
      </Stack>
    </DocsContainer>
  );
}
