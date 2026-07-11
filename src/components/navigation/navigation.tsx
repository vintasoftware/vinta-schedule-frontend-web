'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@vinta-schedule/design-system/ui/button';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from '@vinta-schedule/design-system/ui/navigation-menu';
import { ThemeToggle } from '@/components/navigation/theme-toggle';
import { Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@vinta-schedule/design-system/ui/sheet';

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className='bg-background sticky top-0 z-50 w-full'>
      <div className='container mx-auto px-4'>
        <div className='flex h-16 items-center justify-between'>
          {/* Logo */}
          <Link href='/' className='flex items-center space-x-2'>
            <span className='text-xl font-black'>Vinta Schedule</span>
          </Link>

          {/* Desktop Navigation using NavigationMenu */}
          <div className='hidden items-center space-x-4 md:flex'>
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
          </div>

          {/* Mobile Navigation remains unchanged */}
          <div className='flex items-center space-x-2 p-3 md:hidden'>
            <ThemeToggle />
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button size='icon'>
                  <Menu className='h-4 w-4' />
                </Button>
              </SheetTrigger>
              <SheetContent className='bg-background'>
                <SheetTitle className='sr-only'>Menu</SheetTitle>
                <div className='mt-16 flex flex-col space-y-4 px-8'>
                  <Button asChild className='w-full'>
                    <Link href='/auth/login'>Login</Link>
                  </Button>
                  <Button asChild className='w-full'>
                    <Link href='/auth/signup'>Sign Up</Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
