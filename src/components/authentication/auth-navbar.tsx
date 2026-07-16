'use client';

import Link from 'next/link';

import { Navbar, BrandMark } from 'vinta-schedule-design-system/layout/navbar';
import { HStack } from 'vinta-schedule-design-system/layout';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Image } from 'vinta-schedule-design-system/ui/image';
import { ThemeToggle } from '@/components/navigation/theme-toggle';
import type { TenantBranding } from '@/lib/branding-shared';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';

interface ThemedBrandMarkProps {
  branding: TenantBranding;
}

/**
 * A BrandMark that swaps out the logo and app name when reseller branding is
 * resolved. Falls back to the vinta default when BOTH logoUrl AND appName are
 * the default sentinel values — renders byte-for-byte as today's vinta mark.
 *
 * A tenant with a custom appName but the default logo (or vice-versa) is
 * treated as branded and rendered through the custom path so neither value
 * is silently dropped.
 */
function ThemedBrandMark({ branding }: ThemedBrandMarkProps) {
  const isVintaDefault =
    branding.logoUrl === VINTA_DEFAULT_BRANDING.logoUrl &&
    branding.appName === VINTA_DEFAULT_BRANDING.appName;

  if (isVintaDefault) {
    // Preserve exact vinta rendering — no visual diff for unbranded tenants.
    return <BrandMark />;
  }

  return (
    <HStack gap={2}>
      {/*
       * Reseller logos are arbitrary colored brand assets supplied by the
       * tenant — inverting them in dark mode (as we do for the vinta SVG
       * wordmark) would break their brand colors. The branded image renders
       * as-is in all themes; the reseller is responsible for supplying an
       * asset that works on both light and dark backgrounds.
       *
       * next/image is intentionally NOT used here: reseller logo domains are
       * fully dynamic and cannot be pre-listed in next.config remotePatterns.
       * The DS `Image` atom renders a plain, unoptimized image element, which
       * is exactly what we want here.
       */}
      <Image
        src={branding.logoUrl}
        alt={branding.appName}
        height={20}
        fit='contain'
      />
    </HStack>
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
