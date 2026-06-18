import { Box } from '@/components/layout/box';
import { Flex } from '@/components/layout/flex';
import { Navbar, BrandMark } from '@/components/layout/navbar';
import { ThemeToggle } from '@/components/navigation/theme-toggle';
import Link from 'next/link';

/**
 * PartnerLayout — a neutral chrome for the (partner) route group.
 *
 * Deliberately avoids the tenant AppShell (sidebar, org-context queries, role
 * context). Reseller staff must never see the tenant app shell — they operate
 * in a separate, neutral surface. The layout is minimal: a top navbar with the
 * Vinta brand mark + theme toggle, then the page content below.
 *
 * Gating is API-driven: the /branding/ endpoint is admin+reseller-gated server-
 * side and returns 403 for unauthorized callers. The branding page renders that
 * as a neutral no-access state (useBranding discriminates the response status).
 * The layout intentionally avoids the tenant org-context/role machinery to keep
 * neutral chrome.
 */
export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Flex
      direction='column'
      minHeight='screen'
      bg='background'
      color='foreground'
    >
      <Navbar
        brand={
          <Link href='/'>
            <BrandMark />
          </Link>
        }
        actions={<ThemeToggle />}
      />
      <Box as='main' className='flex-1 px-6 py-10'>
        {children}
      </Box>
    </Flex>
  );
}
