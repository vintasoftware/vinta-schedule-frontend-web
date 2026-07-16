import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Box, Flex, Section } from 'vinta-schedule-design-system/layout';
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
 * Sidebar + a prose-width main column, mirroring the privacy/terms page
 * shell. The main column is a plain `Box` (not a nested `Container`) — a
 * `Container`'s `width: 100%` becomes this flex item's flex-basis and fights
 * the sidebar's fixed width for space; a bare `Box` with `grow`/`maxWidth`
 * sizes correctly without that tug-of-war.
 */
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <Section>
      <Flex
        direction={{ base: 'column', lg: 'row' }}
        align={{ base: 'stretch', lg: 'start' }}
        gap={8}
        px={{ base: 4, md: 8 }}
        mx='auto'
        maxWidth={1200}
      >
        <DocsSidebar />
        <Box grow={1} minWidth={0} maxWidth='68ch'>
          {children}
        </Box>
      </Flex>
    </Section>
  );
}
