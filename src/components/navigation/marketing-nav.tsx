'use client';

import * as React from 'react';
import Link from 'next/link';

import { Box, Text } from 'vinta-schedule-design-system/layout';
import { Navbar, BrandMark } from 'vinta-schedule-design-system/layout/navbar';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { ThemeToggle } from '@/components/navigation/theme-toggle';

/**
 * Public top navigation shared by the marketing home and the docs section, so
 * the docs read as part of the marketing site rather than a bare shell.
 */
export function MarketingNav() {
  const links: { label: string; link: string }[] = [
    {
      label: 'Product',
      link: '/product',
    },
    {
      label: 'Calendar Groups',
      link: '/product/calendar-groups',
    },
    {
      label: 'Developers',
      link: '/docs',
    },
    {
      label: 'Pricing',
      link: '/pricing',
    },
  ];

  // Authenticated visitors see a "Dashboard" link instead of sign-in/up.
  // Resolved after mount to avoid an SSR/client hydration mismatch (localStorage
  // is client-only); defaults to the signed-out actions until then.
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  React.useEffect(() => {
    setIsAuthenticated(
      document.cookie.split('; ').some((c) => c.startsWith('sessionActive='))
    );
  }, []);

  return (
    <Navbar
      brand={
        <Link href='/'>
          <BrandMark />
        </Link>
      }
      links={links.map((link) => (
        <TextLink
          key={link.link}
          href={link.link}
          variant='muted'
          underline='none'
          size='md'
        >
          <Text weight='medium'>{link.label}</Text>
        </TextLink>
      ))}
      actions={
        <>
          <ThemeToggle />
          {isAuthenticated ? (
            <Button asChild size='sm'>
              <Link href='/dashboard'>Dashboard</Link>
            </Button>
          ) : (
            <>
              <Box display={{ base: 'hidden', sm: 'inline-flex' }}>
                <Button asChild variant='ghost' size='sm'>
                  <Link href='/auth/login'>Sign in</Link>
                </Button>
              </Box>
              <Button asChild size='sm'>
                <Link href='/auth/signup'>Sign up</Link>
              </Button>
            </>
          )}
        </>
      }
    />
  );
}
