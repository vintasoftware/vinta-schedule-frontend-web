'use client';

import Link from 'next/link';

import { Navbar, BrandMark } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/navigation/theme-toggle';

/** Shared top navbar for the public authentication pages. */
export function AuthNavbar() {
  return (
    <Navbar
      brand={
        <Link href='/'>
          <BrandMark />
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
