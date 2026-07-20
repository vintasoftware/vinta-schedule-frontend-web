'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Box,
  SidebarGroup,
  SidebarItem,
  VStack,
} from 'vinta-schedule-design-system/layout';
import { DOCS_NAV } from '@/lib/docs/nav';

export type DocsSidebarProps = React.HTMLAttributes<HTMLElement>;

/**
 * Public docs navigation — renders the static `DOCS_NAV` config and highlights
 * whichever section/child matches the current route.
 *
 * Unlike the app's `AppSidebar` (a filled rail anchored to the viewport edge),
 * this is a floating card: the docs body is centered inside a `contained`
 * Container to line up with the marketing nav, so the nav reads as a rounded
 * panel with space around it rather than an edge-to-edge rail. The sticky
 * behavior and the space above it live on the layout wrapper.
 */
function DocsSidebarInner(
  props: DocsSidebarProps,
  ref: React.Ref<HTMLElement>
) {
  const pathname = usePathname();

  // Exact match OR a sub-route of the section's href — mirrors AppSidebar's
  // rule so e.g. '/docs/concepts' doesn't falsely match '/docs/concepts-old'.
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Box
      as='nav'
      ref={ref}
      aria-label='Docs navigation'
      width={256}
      bg='card'
      border
      radius='xl'
      shadow='sm'
      p={3}
      {...props}
    >
      <SidebarGroup>
        {/* Exact match only — every docs route starts with `/docs`, so the
            prefix rule below would keep Overview highlighted everywhere. */}
        <SidebarItem asChild label='Overview' active={pathname === '/docs'}>
          <Link href='/docs' />
        </SidebarItem>
        {DOCS_NAV.map((section) => (
          <VStack key={section.slug} gap={1}>
            <SidebarItem
              asChild
              label={section.title}
              active={isActive(section.href)}
            >
              <Link href={section.href} />
            </SidebarItem>
            {section.children?.length ? (
              <VStack gap={1} pl={4}>
                {section.children.map((item) => (
                  <SidebarItem
                    key={item.slug}
                    asChild
                    label={item.title}
                    active={isActive(item.href)}
                  >
                    <Link href={item.href} />
                  </SidebarItem>
                ))}
              </VStack>
            ) : null}
          </VStack>
        ))}
      </SidebarGroup>
    </Box>
  );
}

const DocsSidebar = React.forwardRef<HTMLElement, DocsSidebarProps>(
  DocsSidebarInner
);

export { DocsSidebar };
