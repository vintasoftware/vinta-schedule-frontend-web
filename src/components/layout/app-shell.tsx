'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';

import { cn } from '@/lib/utils/index';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Box } from './box';
import { Flex } from './flex';
import { Container } from './container';

/**
 * AppShell — the authenticated application frame. Composes an optional sidebar
 * and topbar around a scrollable main region. `width` controls whether the page
 * body is capped to the contained 1200px column or runs full-bleed.
 *
 * Responsive: the shell is an `@container/app`. Above @4xl (896px) the sidebar
 * is docked on the left; below that it collapses into a slide-over drawer
 * toggled by a hamburger (injected into the topbar's `leading` slot, or shown
 * in a thin mobile bar when there's no topbar). The page body is an
 * `@container/content` so content reacts to its own width, not the viewport.
 *
 * Covers every generic page layout by toggling props:
 *   sidebar + topbar · topbar only · no bars  ×  contained | full
 */
export interface AppShellProps {
  sidebar?: React.ReactNode;
  topbar?: React.ReactNode;
  width?: 'contained' | 'full';
  className?: string;
  /** Extra classes on the <Container> wrapping page content. */
  contentClassName?: string;
  children?: React.ReactNode;
}

function AppShell({
  sidebar,
  topbar,
  width = 'contained',
  className,
  contentClassName,
  children,
}: AppShellProps) {
  const trigger = sidebar ? (
    <SheetTrigger asChild>
      <Button
        variant='ghost'
        size='icon'
        aria-label='Open navigation'
        className='-ml-1 shrink-0 @4xl/app:hidden'
      >
        <Menu />
      </Button>
    </SheetTrigger>
  ) : null;

  // Inject the mobile trigger into the topbar's leading slot when possible so
  // the hamburger sits inline with the page title.
  const topbarNode =
    topbar && trigger && React.isValidElement(topbar)
      ? React.cloneElement(
          topbar as React.ReactElement<{ leading?: React.ReactNode }>,
          { leading: trigger }
        )
      : topbar;

  const shell = (
    <Flex
      height='screen'
      width='full'
      overflow='hidden'
      bg='background'
      color='foreground'
      className={cn('@container/app', className)}
    >
      {/* Docked sidebar — display:contents above @4xl so the aside is a direct
          flex child; fully hidden below (the drawer takes over). */}
      {sidebar ? (
        <div className='hidden @4xl/app:contents'>{sidebar}</div>
      ) : null}

      <Flex direction='column' grow={1} minWidth={0} overflow='hidden'>
        {topbarNode}

        {/* Mobile bar with just the trigger, for the no-topbar layouts. */}
        {sidebar && !topbar ? (
          <div className='flex h-14 shrink-0 items-center border-b border-border px-4 @4xl/app:hidden'>
            {trigger}
          </div>
        ) : null}

        <Box as='main' grow={1} overflow='auto' className='@container/content'>
          <Container width={width} py={8} className={contentClassName}>
            {children}
          </Container>
        </Box>
      </Flex>
    </Flex>
  );

  if (!sidebar) return shell;

  return (
    <Sheet>
      {shell}
      <SheetContent side='left' className='w-[244px] p-0'>
        <SheetTitle className='sr-only'>Navigation</SheetTitle>
        {sidebar}
      </SheetContent>
    </Sheet>
  );
}

export { AppShell };
