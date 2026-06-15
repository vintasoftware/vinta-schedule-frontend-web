'use client';

import * as React from 'react';
import { Check, RefreshCw, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils/index';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SyncState = 'synced' | 'syncing';

/**
 * AppTopbar — in-app header bar. Page title + subtitle on the left, optional
 * search, a sync-status pill, and action slot on the right. Sticky + blurred.
 */
export interface AppTopbarProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  'title'
> {
  /** Optional — omit for a minimal bar (e.g. just a leading trigger + actions). */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Leading slot — e.g. a mobile nav trigger injected by AppShell. */
  leading?: React.ReactNode;
  showSearch?: boolean;
  searchPlaceholder?: string;
  sync?: SyncState | null;
}

const AppTopbar = React.forwardRef<HTMLElement, AppTopbarProps>(
  function AppTopbar(
    {
      className,
      title,
      subtitle,
      actions,
      leading,
      showSearch = true,
      searchPlaceholder = 'Search people & resources',
      sync = 'synced',
      ...props
    },
    ref
  ) {
    const [searchOpen, setSearchOpen] = React.useState(false);
    return (
      <header
        ref={ref}
        className={cn(
          // @container/topbar so the inner controls react to the bar's own
          // width, not the viewport — they collapse first when a sidebar eats
          // the horizontal space. `relative` anchors the search overlay.
          'border-border bg-background/80 @container/topbar relative sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b px-4 backdrop-blur @2xl/topbar:gap-4 @2xl/topbar:px-6',
          className
        )}
        {...props}
      >
        {leading}

        {title || subtitle ? (
          <div className='min-w-0'>
            {title ? (
              <h1 className='truncate text-[15px] leading-tight font-semibold @2xl/topbar:text-[17px]'>
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className='text-muted-foreground truncate text-[12.5px] leading-tight'>
                {subtitle}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className='flex-1' />

        {showSearch ? (
          <>
            {/* Narrow: collapse the field to an icon button that expands the
                full-width search overlay. */}
            <Button
              variant='ghost'
              size='icon'
              aria-label={searchPlaceholder}
              onClick={() => setSearchOpen(true)}
              className='shrink-0 @3xl/topbar:hidden'
            >
              <Search />
            </Button>
            <div className='relative hidden w-64 @3xl/topbar:block'>
              <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
              <Input className='pl-9' placeholder={searchPlaceholder} />
            </div>
          </>
        ) : null}

        {sync ? (
          <Badge
            variant={sync === 'synced' ? 'success' : 'info'}
            className='shrink-0'
          >
            {sync === 'synced' ? (
              <Check />
            ) : (
              <RefreshCw className='animate-spin' />
            )}
            <span className='hidden @xl/topbar:inline'>
              {sync === 'synced' ? 'All synced' : 'Syncing…'}
            </span>
          </Badge>
        ) : null}

        {actions}

        {/* Expanded search — full-width, covers the bar. Autofocused; X closes. */}
        {showSearch && searchOpen ? (
          <div className='bg-background absolute inset-0 z-10 flex items-center gap-2 px-4 @2xl/topbar:px-6'>
            <Search className='text-muted-foreground size-4 shrink-0' />
            <Input
              autoFocus
              placeholder={searchPlaceholder}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchOpen(false);
              }}
              className='h-9 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0'
            />
            <Button
              variant='ghost'
              size='icon'
              aria-label='Close search'
              onClick={() => setSearchOpen(false)}
              className='shrink-0'
            >
              <X />
            </Button>
          </div>
        ) : null}
      </header>
    );
  }
);

export { AppTopbar };
