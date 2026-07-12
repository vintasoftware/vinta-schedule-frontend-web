'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Box,
  Container,
  HStack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';
import { Button } from 'vinta-schedule-design-system/ui/button';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from 'vinta-schedule-design-system/ui/navigation-menu';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { ThemeToggle } from '@/components/navigation/theme-toggle';
import { Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from 'vinta-schedule-design-system/ui/sheet';

// TODO(ds-gap): BoxStyleProps has `position` but no inset (`top`) or `zIndex`
// prop, and TextWeight stops at `extrabold` (there is no `black`/900). Both are
// expressed as inline token values below rather than as utility classes.
const STICKY_STYLE = { top: 0, zIndex: 50 } as const;
const WORDMARK_STYLE = { fontWeight: 900 } as const;

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Box
      as='nav'
      position='sticky'
      width='full'
      bg='background'
      style={STICKY_STYLE}
    >
      <Container>
        <HStack height={64} justify='between'>
          {/* Logo */}
          <TextLink asChild variant='inherit' underline='none'>
            <Link href='/'>
              <Text size='xl' style={WORDMARK_STYLE}>
                Vinta Schedule
              </Text>
            </Link>
          </TextLink>

          {/* Desktop Navigation using NavigationMenu */}
          <Box display={{ base: 'hidden', md: 'block' }}>
            <HStack gap={4}>
              <ThemeToggle />
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuLink asChild>
                      <Link href='/auth/login'>Login</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuLink asChild>
                      <Link href='/auth/signup'>Sign Up</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </HStack>
          </Box>

          {/* Mobile Navigation remains unchanged */}
          <Box display={{ base: 'block', md: 'hidden' }}>
            <HStack gap={2} p={3}>
              <ThemeToggle />
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button size='icon'>
                    <Menu />
                  </Button>
                </SheetTrigger>
                {/* className: SheetContent is a shadcn atom with no `bg` prop. */}
                <SheetContent className='bg-background'>
                  {/* TODO(ds-gap): no VisuallyHidden primitive — `sr-only` has no prop. */}
                  <SheetTitle className='sr-only'>Menu</SheetTitle>
                  {/* A column flex stretches its items, so the buttons fill the
                      width without the old `w-full`. */}
                  <VStack gap={4} mt={16} px={8}>
                    <Button asChild>
                      <Link href='/auth/login'>Login</Link>
                    </Button>
                    <Button asChild>
                      <Link href='/auth/signup'>Sign Up</Link>
                    </Button>
                  </VStack>
                </SheetContent>
              </Sheet>
            </HStack>
          </Box>
        </HStack>
      </Container>
    </Box>
  );
}
