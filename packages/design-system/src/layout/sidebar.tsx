import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Slot, Slottable } from '@radix-ui/react-slot';

import { cn } from '../lib/utils';
import { Icon } from '../ui/icon';
import type { IconName } from '../ui/icon-registry';
import { Box } from './box';
import { Flex, VStack } from './flex';
import { Text } from './text';
import type { Size } from './layout-style';

/**
 * Sidebar — the generic, presentational app-navigation rail.
 *
 * Every prop here is SERIALIZABLE (strings, numbers, booleans), so the whole
 * rail can be driven from plain data/config. The app's own AppSidebar composes
 * these pieces and supplies the parts that can never be serialized: the router
 * (`usePathname` for `active`), `next/link` (via `asChild`), the org switcher,
 * and the account menu.
 *
 *   <Sidebar brand={…} footer={…}>
 *     <SidebarGroup label='Configure'>
 *       <SidebarItem label='Settings' iconName='settings' href='/settings' />
 *     </SidebarGroup>
 *   </Sidebar>
 */
export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  /** Rail width. Defaults to 256px. */
  width?: Size;
  /** Top of the rail — wordmark, org switcher. */
  brand?: React.ReactNode;
  /** Bottom of the rail — account menu, theme toggle. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(function Sidebar(
  { width = 256, brand, footer, children, className, ...props },
  ref
) {
  return (
    <Flex
      ref={ref}
      as='aside'
      direction='column'
      width={width}
      height='full'
      bg='sidebar'
      borderRight
      borderColor='sidebar-border'
      className={className}
      {...props}
    >
      {brand ? (
        <Box px={3} py={4}>
          {brand}
        </Box>
      ) : null}

      {/* Nav takes the slack so the footer pins to the bottom. */}
      <VStack as='nav' gap={4} px={3} py={2} grow overflow='auto'>
        {children}
      </VStack>

      {footer ? (
        <Box px={3} py={3} borderTop borderColor='sidebar-border'>
          {footer}
        </Box>
      ) : null}
    </Flex>
  );
});

/* -------------------------------------------------------------------------- */

export interface SidebarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional section heading above the items. */
  label?: string;
  children?: React.ReactNode;
}

const SidebarGroup = React.forwardRef<HTMLDivElement, SidebarGroupProps>(
  function SidebarGroup({ label, children, ...props }, ref) {
    return (
      <VStack ref={ref} gap={1} {...props}>
        {label ? (
          <Text
            size='xs'
            weight='medium'
            color='muted-foreground'
            uppercase
            tracking='wide'
            px={2}
            pb={1}
          >
            {label}
          </Text>
        ) : null}
        {children}
      </VStack>
    );
  }
);

/* -------------------------------------------------------------------------- */

export interface SidebarItemProps extends React.HTMLAttributes<HTMLElement> {
  label: string;
  /**
   * Icon by REGISTRY KEY — a string, so it can come from data/config.
   * See ui/icon-registry.
   */
  iconName?: IconName;
  /**
   * Icon as a component. The ergonomic form in code; wins over `iconName`.
   * A React component is not serializable, so it can never come from JSON.
   */
  icon?: LucideIcon;
  /** Renders as a link when set; otherwise a button. */
  href?: string;
  /** Current-route styling. The app derives this from the router. */
  active?: boolean;
  /** Trailing count (e.g. unread bookings). */
  badge?: string | number;
  /**
   * Render `children` as the row element instead of the default anchor/button —
   * how the app composes it with `next/link` for real client-side routing:
   *
   *   <SidebarItem asChild label='Bookings' iconName='calendar-days'>
   *     <Link href='/bookings' />
   *   </SidebarItem>
   *
   * The icon / label / badge become the children of the passed element. This
   * needs Radix's `<Slottable>`: a plain `<Slot>` accepts only ONE child, and
   * this row renders three, so without it Slot throws.
   */
  asChild?: boolean;
  children?: React.ReactNode;
}

const SidebarItem = React.forwardRef<HTMLElement, SidebarItemProps>(
  function SidebarItem(
    {
      label,
      iconName,
      icon,
      href,
      active = false,
      badge,
      asChild = false,
      children,
      className,
      ...props
    },
    ref
  ) {
    const Comp = asChild ? Slot : href ? 'a' : 'button';

    return (
      <Flex
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        as={Comp as any}
        ref={ref}
        {...(asChild ? {} : href ? { href } : { type: 'button' })}
        align='center'
        gap={3}
        px={2}
        height={36}
        radius='md'
        width='full'
        textAlign='left'
        bg={active ? 'sidebar-accent' : undefined}
        color={active ? 'sidebar-accent-foreground' : 'sidebar-foreground'}
        // :hover is a pseudo-class — it has no inline-style form.
        className={cn(
          'cursor-pointer transition-colors',
          !active && 'hover:bg-sidebar-accent',
          className
        )}
        aria-current={active ? 'page' : undefined}
        {...props}
      >
        {icon || iconName ? (
          <Icon
            icon={icon}
            name={iconName}
            size='sm'
            color={active ? 'primary' : 'muted-foreground'}
          />
        ) : null}

        <Text as='span' size='sm' weight='medium' grow truncate>
          {label}
        </Text>

        {/* Marks WHICH child Slot should clone as the row element. Slot merges
            the row's props onto it and renders these siblings inside it. */}
        {asChild ? <Slottable>{children}</Slottable> : null}

        {badge != null ? (
          <Text
            as='span'
            size='xs'
            weight='medium'
            bg='vinta-50'
            color='primary'
            radius='full'
            px={2}
            shrink={0}
          >
            {badge}
          </Text>
        ) : null}
      </Flex>
    );
  }
);

export { Sidebar, SidebarGroup, SidebarItem };
