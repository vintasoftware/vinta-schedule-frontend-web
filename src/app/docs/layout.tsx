import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Box, Container, Flex } from 'vinta-schedule-design-system/layout';
import { DocsSidebar } from '@/components/docs/docs-sidebar';
import { MarketingNav } from '@/components/navigation/marketing-nav';
import { MarketingFooter } from '@/components/navigation/marketing-footer';

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
 * The marketing top nav (72px, sticky) sits above the docs body. The body is
 * wrapped in the same `contained` Container the nav uses, so the sidebar +
 * content span line up under the nav — same max width and centered position on
 * bigger screens. Inside it, a two-column band: a sidebar rail that sticks
 * under the nav and scrolls on its own, and a content column that each page
 * caps to its own measure via `DocsContainer`. On small screens the two columns
 * stack and the rail becomes a plain block on top.
 */
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingNav />
      <Container width='contained'>
        <Flex
          direction={{ base: 'column', lg: 'row' }}
          align='stretch'
          gap={{ base: 4, lg: 8 }}
        >
          <Box
            shrink={0}
            py={{ base: 4, lg: 10 }}
            className='lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-72px)] lg:self-start lg:overflow-y-auto'
          >
            <DocsSidebar />
          </Box>
          <Box grow={1} minWidth={0} py={{ base: 6, lg: 10 }}>
            {children}
          </Box>
        </Flex>
      </Container>
      <MarketingFooter />
    </>
  );
}
