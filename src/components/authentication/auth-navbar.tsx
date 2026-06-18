'use client';

import Link from 'next/link';

import { Navbar, BrandMark } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/navigation/theme-toggle';
import type { TenantBranding } from '@/lib/branding';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding';
import { cn } from '@/lib/utils/index';

interface ThemedBrandMarkProps {
  branding: TenantBranding;
  className?: string;
}

/**
 * A BrandMark that swaps out the logo and app name when reseller branding is
 * resolved. Falls back to the vinta default when logoUrl / appName are the
 * default sentinel values — renders byte-for-byte as today's vinta mark.
 */
function ThemedBrandMark({ branding, className }: ThemedBrandMarkProps) {
  const isVintaDefault = branding.logoUrl === VINTA_DEFAULT_BRANDING.logoUrl;

  if (isVintaDefault) {
    // Preserve exact vinta rendering — no visual diff for unbranded tenants.
    return <BrandMark className={className} />;
  }

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={branding.logoUrl}
        alt={branding.appName}
        className='h-5 w-auto'
      />
    </div>
  );
}

export interface AuthNavbarProps {
  /**
   * Resolved tenant branding. When not provided or when it equals the vinta
   * default, the navbar renders exactly as today's vinta navbar.
   */
  branding?: TenantBranding;
}

/** Shared top navbar for the public authentication pages. */
export function AuthNavbar({
  branding = VINTA_DEFAULT_BRANDING,
}: AuthNavbarProps) {
  return (
    <Navbar
      brand={
        <Link href='/'>
          <ThemedBrandMark branding={branding} />
        </Link>
      }
      actions={
        <>
          <ThemeToggle />
          <Button asChild variant='ghost' size='sm'>
            <Link href='/auth/login'>Sign in</Link>
          </Button>
          <Button asChild size='sm'>
            <Link href='/auth/signup'>Sign up</Link>
          </Button>
        </>
      }
    />
  );
}
