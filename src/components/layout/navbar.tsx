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
import { HStack, VStack } from './flex';
import { Container } from './container';
import { Text } from './text';

/** Brand wordmark used across the public navbar and auth pages. */
function BrandMark({ className }: { className?: string }) {
  return (
    <HStack className={cn('gap-2.5', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src='/vinta-wordmark.svg'
        alt='Vinta'
        className='h-5 w-auto dark:brightness-0 dark:invert'
      />
      <Text
        size='sm'
        weight='medium'
        color='muted-foreground'
        className='border-border border-l pl-2.5'
      >
        Schedule
      </Text>
    </HStack>
  );
}

/**
 * Navbar — public / marketing top navigation bar. Sticky, blurred surface with
 * a brand on the left, nav links in the middle, and actions on the right.
 *
 * Responsive: the inner row is an `@container/nav`. Links dock inline above
 * @3xl (768px) and actions above @md (448px); below those breakpoints they
 * collapse into a slide-over menu opened by a hamburger.
 */
export interface NavbarProps extends React.HTMLAttributes<HTMLElement> {
  brand?: React.ReactNode;
  /** Center nav links. */
  links?: React.ReactNode;
  /** Right-aligned actions (theme toggle, auth buttons…). */
  actions?: React.ReactNode;
  /** Cap the inner row to the contained width (default) or let it run full. */
  width?: 'contained' | 'full';
}

const Navbar = React.forwardRef<HTMLElement, NavbarProps>(function Navbar(
  { className, brand, links, actions, width = 'contained', ...props },
  ref
) {
  const hasMenu = Boolean(links || actions);
  return (
    <Box
      as='header'
      ref={ref as React.Ref<HTMLElement>}
      className={cn(
        'border-border bg-background/80 sticky top-0 z-40 w-full border-b backdrop-blur',
        className
      )}
      {...props}
    >
      <Container width={width}>
        <HStack
          justify='between'
          gap={6}
          height={72}
          py={3}
          className='@container/nav'
        >
          <HStack gap={10}>
            {brand ?? <BrandMark />}
            {links ? (
              <Box as='nav' className='hidden items-center gap-6 @3xl/nav:flex'>
                {links}
              </Box>
            ) : null}
          </HStack>

          <div className='flex items-center gap-3'>
            {actions ? (
              <div className='hidden items-center gap-3 @md/nav:flex'>
                {actions}
              </div>
            ) : null}

            {hasMenu ? (
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label='Open menu'
                    className='@3xl/nav:hidden'
                  >
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent side='right' className='w-72'>
                  <SheetTitle className='sr-only'>Menu</SheetTitle>
                  {links ? (
                    <VStack as='nav' gap={1} className='mt-8'>
                      {links}
                    </VStack>
                  ) : null}
                  {actions ? (
                    <VStack
                      gap={2}
                      className='border-border mt-6 border-t pt-6'
                    >
                      {actions}
                    </VStack>
                  ) : null}
                </SheetContent>
              </Sheet>
            ) : null}
          </div>
        </HStack>
      </Container>
    </Box>
  );
});

export { Navbar, BrandMark };
