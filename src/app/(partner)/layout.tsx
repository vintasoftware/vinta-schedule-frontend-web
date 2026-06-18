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
 * Auth / org gating is NOT done in this layout — the individual pages own role
 * gating (useRequireRole). The API enforces the reseller check (403).
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
      <main className='flex flex-1 flex-col px-6 py-10'>{children}</main>
    </Flex>
  );
}
