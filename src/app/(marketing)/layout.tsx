import type { ReactNode } from 'react';

import { Box } from 'vinta-schedule-design-system/layout';
import { MarketingNav } from '@/components/navigation/marketing-nav';
import { MarketingFooter } from '@/components/navigation/marketing-footer';

/**
 * Shell for the public marketing pages (`/product`, `/pricing`, `/security`,
 * `/privacy`, `/terms`, …). Wraps them in the shared marketing nav and footer so
 * every public page reads as part of the same site. The landing page (`/`) and
 * the docs shell render the nav/footer themselves, so they stay outside this
 * group.
 */
export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Box bg='background'>
      <MarketingNav />
      <Box as='main'>{children}</Box>
      <MarketingFooter />
    </Box>
  );
}
