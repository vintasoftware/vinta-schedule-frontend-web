import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import {
  Box,
  Container,
  Flex,
  Section,
} from 'vinta-schedule-design-system/layout';
import { DocsSidebar } from '@/components/docs/docs-sidebar';

export const metadata: Metadata = {
  title: {
    template: '%s · Vinta Schedule API Docs',
    default: 'Vinta Schedule API Docs',
  },
};

/**
 * Public docs shell — no `(app)` auth wrapper. Docs must render for anonymous
 * prospects linked from marketing, so this sits alongside `privacy` / `terms`,
 * not under the authenticated route group.
 *
 * Sidebar + a prose-width main column. Container is nested inside a grow/minWidth
 * Box for the main content, following the AppShell pattern. This keeps Container
 * as the single source of truth for width values. The outer Container caps the
 * entire row at contained width; the inner Container caps the main column to
 * prose width.
 */
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <Section>
      <Container width='contained'>
        <Flex
          direction={{ base: 'column', lg: 'row' }}
          align={{ base: 'stretch', lg: 'start' }}
          gap={8}
        >
          <DocsSidebar />
          <Box grow={1} minWidth={0}>
            <Container width='prose'>{children}</Container>
          </Box>
        </Flex>
      </Container>
    </Section>
  );
}
