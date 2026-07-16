'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarGroup,
  SidebarItem,
  VStack,
} from 'vinta-schedule-design-system/layout';
import { DOCS_NAV } from '@/lib/docs/nav';

export type DocsSidebarProps = React.HTMLAttributes<HTMLElement>;

/**
 * Public docs sidebar — renders the static `DOCS_NAV` config and highlights
 * whichever section/child matches the current route. No dynamic discovery;
 * later phases only add entries to `DOCS_NAV`, this component doesn't change.
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
    <Sidebar ref={ref} aria-label='Docs navigation' {...props}>
      <SidebarGroup>
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
    </Sidebar>
  );
}

const DocsSidebar = React.forwardRef<HTMLElement, DocsSidebarProps>(
  DocsSidebarInner
);

export { DocsSidebar };
