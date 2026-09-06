'use client';

/**
 * PublicBookingShell — branding chrome shared by every public booking page.
 *
 * Target-agnostic on purpose: Phase 2 mounts it for the single-calendar book
 * flow, but Phases 3–5 (appointment type booking, reschedule/cancel) all sit on the same
 * two routes (`/book/[code]`, `/o/[slug]/book/[code]`) and reuse this exact
 * chrome — it must not carry anything specific to "booking a single
 * calendar".
 *
 * Mirrors `AuthNavbar` (`@/components/authentication/auth-navbar.tsx`), the
 * repo's other public, branding-aware navbar: swap the wordmark for a
 * reseller's logo when `branding` isn't the vinta default, otherwise render
 * byte-for-byte as today's vinta navbar. Unlike `AuthNavbar`, there is no
 * "Sign in / Sign up" pair here — an external attendee holding a booking
 * link isn't being funneled toward creating an account.
 */

import { BrandMark, Navbar } from 'vinta-schedule-design-system/layout/navbar';
import { Box, Center, Flex, HStack } from 'vinta-schedule-design-system/layout';
import { Image } from 'vinta-schedule-design-system/ui/image';
import { ThemeToggle } from '@/components/navigation/theme-toggle';
import type { TenantBranding } from '@/lib/branding-shared';
import { isVintaDefaultBranding } from '@/lib/branding-shared';

function BrandedMark({ branding }: { branding: TenantBranding }) {
  if (isVintaDefaultBranding(branding)) {
    return <BrandMark />;
  }

  return (
    <HStack gap={2}>
      {/*
       * Reseller logos are arbitrary assets on arbitrary domains — next/image
       * can't pre-list them in next.config remotePatterns, so this uses the
       * DS `Image` atom (a plain, unoptimized <img>), same as AuthNavbar.
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

export interface PublicBookingShellProps {
  branding: TenantBranding;
  children: React.ReactNode;
}

export function PublicBookingShell({
  branding,
  children,
}: PublicBookingShellProps) {
  return (
    <Flex
      direction='column'
      minHeight='screen'
      bg='background'
      color='foreground'
    >
      <Navbar
        brand={<BrandedMark branding={branding} />}
        actions={<ThemeToggle />}
      />
      <Center as='main' grow={1} px={4} py={12}>
        <Box width='full' maxWidth={640}>
          {children}
        </Box>
      </Center>
    </Flex>
  );
}
