'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  CalendarSync,
  ChevronsUpDown,
  ListChecks,
  LogOut,
  Moon,
  Settings,
  Shield,
  Sun,
  Ticket,
  User,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils/index';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from 'vinta-schedule-design-system/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'vinta-schedule-design-system/ui/dropdown-menu';
import type { MyMembership } from '@/client';
import { OrgSwitcher } from '@/components/organizations/org-switcher';
import {
  Box,
  Center,
  Flex,
  HStack,
  Text,
  VStack,
  type FlexProps,
} from 'vinta-schedule-design-system/layout';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { Image } from 'vinta-schedule-design-system/ui/image';

// <Flex as='button'> renders a real <button>, but FlexProps is typed against the
// generic HTMLAttributes set, so `type` is not in it. Widen the component once
// here (the same trick the DS itself uses for <FormLayout>'s <form>).
const FlexButton = Flex as unknown as React.ForwardRefExoticComponent<
  FlexProps &
    React.ButtonHTMLAttributes<HTMLButtonElement> &
    React.RefAttributes<HTMLElement>
>;

// ---------------------------------------------------------------------------
// TODO(ds-gap): the sidebar chrome needs four things the DS has no prop for:
//   1. a single-edge border (`border-r` / `border-b` / `border-t`) — `border` is
//      all-or-nothing, and <Divider> can't draw a container's own edge;
//   2. :hover surfaces + `transition-colors` on a row;
//   3. this design's 10px / 2px / 6px metrics, which are off the 4px Space scale;
//   4. 13px / 11px font sizes, which are between the `xs` and `sm` Text tokens.
// (1), (3) and (4) are carried as token-referencing inline values below; (2) is
// the only thing that still needs a utility class (a pseudo-class cannot be
// expressed inline).
// ---------------------------------------------------------------------------
const ASIDE_STYLE: React.CSSProperties = {
  borderRight: '1px solid var(--sidebar-border)',
};
const BRAND_STYLE: React.CSSProperties = {
  gap: '0.625rem',
  borderBottom: '1px solid var(--sidebar-border)',
};
const BRAND_WORDMARK_STYLE: React.CSSProperties = {
  borderLeft: '1px solid var(--border)',
  paddingLeft: '0.625rem',
  fontSize: '13px',
};
const GROUP_STYLE: React.CSSProperties = { gap: '0.125rem' };
const GROUP_LABEL_STYLE: React.CSSProperties = {
  paddingInline: '0.625rem',
  paddingBottom: '0.375rem',
  fontSize: '11px',
  letterSpacing: '0.06em',
};
const NAV_ROW_STYLE: React.CSSProperties = {
  paddingInline: '0.625rem',
  fontSize: '0.875rem',
  fontWeight: 500,
};
const NAV_BADGE_STYLE: React.CSSProperties = {
  paddingInline: '0.375rem',
  paddingBlock: '0.125rem',
  fontSize: '11px',
  fontWeight: 600,
};
const NAV_LABEL_STYLE: React.CSSProperties = { flexGrow: 1 };
const FOOTER_STYLE: React.CSSProperties = {
  borderTop: '1px solid var(--sidebar-border)',
};
const FOOTER_ROW_STYLE: React.CSSProperties = {
  gap: '0.625rem',
  paddingInline: '0.625rem',
};
const THEME_LABEL_STYLE: React.CSSProperties = { fontSize: '13px' };
const ORG_AVATAR_STYLE: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
};
const PRIMARY_LINE_STYLE: React.CSSProperties = { fontSize: '13px' };
const SECONDARY_LINE_STYLE: React.CSSProperties = { fontSize: '11px' };

/** The only utility class left in this file: a :hover surface has no DS prop. */
const HOVER_ROW_CLASS = 'hover:bg-sidebar-accent transition-colors';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  /** Optional route href. When present the item renders as a Next.js Link. */
  href?: string;
}

export interface SidebarNavGroup {
  label?: string;
  items: SidebarNavItem[];
}

const DEFAULT_GROUPS: SidebarNavGroup[] = [
  {
    items: [
      { id: 'calendar', label: 'Calendar', icon: Calendar },
      { id: 'calendars', label: 'Connected calendars', icon: CalendarSync },
      { id: 'groups', label: 'Calendar groups', icon: UsersRound },
      { id: 'bookings', label: 'Bookings', icon: Ticket, badge: 8 },
    ],
  },
  {
    label: 'Configure',
    items: [
      { id: 'types', label: 'Appointment types', icon: ListChecks },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

/** The shared layout of a nav row, whether it renders as a link or a button. */
function navRowProps(active: boolean) {
  return {
    align: 'center' as const,
    gap: 3 as const,
    height: 36,
    radius: 'md' as const,
    textAlign: 'left' as const,
    bg: active ? 'sidebar-accent' : undefined,
    color: active ? 'sidebar-accent-foreground' : 'sidebar-foreground',
    style: NAV_ROW_STYLE,
    className: cn('transition-colors', !active && 'hover:bg-sidebar-accent'),
  };
}

/** Icon + label (+ optional count) — the inside of a nav row. */
function NavRowContent({
  item,
  active,
}: {
  item: SidebarNavItem;
  active: boolean;
}) {
  return (
    <>
      <Icon
        icon={item.icon}
        size='sm'
        color={active ? 'primary' : 'muted-foreground'}
      />
      <Text as='span' align='left' style={NAV_LABEL_STYLE}>
        {item.label}
      </Text>
      {item.badge != null ? (
        <Box
          as='span'
          bg='vinta-50'
          color='primary'
          radius='full'
          style={NAV_BADGE_STYLE}
        >
          {item.badge}
        </Box>
      ) : null}
    </>
  );
}

export interface AppSidebarProps extends React.HTMLAttributes<HTMLElement> {
  groups?: SidebarNavGroup[];
  activeId?: string;
  onNavigate?: (id: string) => void;
  orgName?: string;
  orgMeta?: string;
  userName?: string;
  userEmail?: string;
  userInitials?: string;
  userPicture?: string;
  /** Called when the user selects "Log out" from the account menu. */
  onLogout?: () => void;
  /**
   * Full list of the user's active memberships. When 1+ are provided (with an
   * onSelectOrg handler) the static org button is replaced with an interactive
   * OrgSwitcher dropdown — a single-org user still needs the switcher to reach
   * "+ New organization". When absent or empty, the existing static org button
   * renders unchanged so design stories and consumers are unaffected.
   */
  memberships?: MyMembership[];
  /** The string id of the currently active org (e.g. "1"). */
  activeOrgId?: string | null;
  /** Called when the user picks a different org from the switcher. */
  onSelectOrg?: (orgId: string) => void;
  /** Called when the user clicks "+ New organization" in the switcher. Phase 5 wires this. */
  onCreateOrg?: () => void;
}

// AppSidebarInner is a named component so hooks are valid without any
// eslint-disable. The exported AppSidebar wraps it in forwardRef below.
function AppSidebarInner(
  {
    className,
    groups = DEFAULT_GROUPS,
    activeId = 'calendar',
    onNavigate,
    orgName = 'Quilted Health',
    orgMeta = 'Pro · 12 calendars',
    userName = 'Renata Pires',
    userEmail = 'renata@quilted.health',
    userInitials = 'RP',
    userPicture,
    onLogout,
    memberships,
    activeOrgId,
    onSelectOrg,
    onCreateOrg,
    ...props
  }: AppSidebarProps,
  ref: React.Ref<HTMLElement>
) {
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const toggleTheme = () => {
    if (theme === 'system') {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    } else {
      setTheme(theme === 'light' ? 'dark' : 'light');
    }
  };
  const isDark = mounted && resolvedTheme === 'dark';
  return (
    <VStack
      as='aside'
      ref={ref as React.Ref<HTMLElement>}
      width={244}
      height='full'
      shrink={0}
      bg='sidebar'
      style={ASIDE_STYLE}
      className={className}
      {...props}
    >
      {/* Brand */}
      <HStack height={64} px={5} style={BRAND_STYLE}>
        {/* className: a `dark:` filter (invert the wordmark) has no DS prop. */}
        <Image
          src='/vinta-wordmark.svg'
          alt='Vinta'
          height={19}
          width='auto'
          fit='contain'
          className='dark:brightness-0 dark:invert'
        />
        <Text
          weight='medium'
          color='muted-foreground'
          style={BRAND_WORDMARK_STYLE}
        >
          Schedule
        </Text>
      </HStack>

      {/* Nav */}
      <VStack as='nav' grow={1} gap={5} px={3} py={4} overflow='auto'>
        {groups.map((group, i) => (
          <VStack
            key={group.label ?? i}
            mt={i > 0 ? 3 : undefined}
            style={GROUP_STYLE}
          >
            {group.label ? (
              <Text
                weight='semibold'
                uppercase
                color='muted-foreground'
                style={GROUP_LABEL_STYLE}
              >
                {group.label}
              </Text>
            ) : null}
            {group.items.map((item) => {
              // An item is active if it matches the explicit activeId prop OR
              // (when it has an href) if the current pathname is exactly that href
              // OR starts with that href followed by '/'. The latter guard
              // prevents '/team' from falsely matching '/team-x'.
              const active =
                item.id === activeId ||
                (item.href != null &&
                  (pathname === item.href ||
                    pathname.startsWith(item.href + '/')));

              if (item.href) {
                return (
                  <Link key={item.id} href={item.href}>
                    <Flex {...navRowProps(active)}>
                      <NavRowContent item={item} active={active} />
                    </Flex>
                  </Link>
                );
              }
              return (
                <FlexButton
                  key={item.id}
                  as='button'
                  type='button'
                  onClick={() => onNavigate?.(item.id)}
                  {...navRowProps(active)}
                >
                  <NavRowContent item={item} active={active} />
                </FlexButton>
              );
            })}
          </VStack>
        ))}
      </VStack>

      {/* Org + user */}
      <VStack gap={1} p={3} style={FOOTER_STYLE}>
        <FlexButton
          as='button'
          type='button'
          onClick={toggleTheme}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          align='center'
          height={36}
          radius='md'
          textAlign='left'
          style={FOOTER_ROW_STYLE}
          className={HOVER_ROW_CLASS}
        >
          <Icon icon={isDark ? Sun : Moon} size='sm' color='muted-foreground' />
          <Text as='span' style={THEME_LABEL_STYLE}>
            {isDark ? 'Light mode' : 'Dark mode'}
          </Text>
        </FlexButton>
        {memberships && memberships.length >= 1 && onSelectOrg ? (
          <OrgSwitcher
            memberships={memberships}
            activeOrgId={activeOrgId ?? null}
            onSelect={onSelectOrg}
            onCreateOrg={onCreateOrg}
          />
        ) : (
          <FlexButton
            as='button'
            type='button'
            align='center'
            height={44}
            radius='md'
            textAlign='left'
            style={FOOTER_ROW_STYLE}
            className={HOVER_ROW_CLASS}
          >
            <Center
              width={28}
              height={28}
              radius='md'
              bg='vinta-600'
              color='#ffffff'
              shrink={0}
              style={ORG_AVATAR_STYLE}
            >
              {orgName.charAt(0)}
            </Center>
            <Box minWidth={0} grow={1}>
              <Text
                as='div'
                weight='semibold'
                leading='tight'
                truncate
                style={PRIMARY_LINE_STYLE}
              >
                {orgName}
              </Text>
              <Text
                as='div'
                color='muted-foreground'
                leading='tight'
                style={SECONDARY_LINE_STYLE}
              >
                {orgMeta}
              </Text>
            </Box>
          </FlexButton>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <FlexButton
              as='button'
              type='button'
              aria-label='Account menu'
              align='center'
              height={44}
              radius='md'
              textAlign='left'
              style={FOOTER_ROW_STYLE}
              className={HOVER_ROW_CLASS}
            >
              {/* className: Avatar / AvatarFallback are shadcn atoms with no
                  size or color props. */}
              <Avatar className='size-7'>
                {userPicture ? (
                  <AvatarImage src={userPicture} alt={userName} />
                ) : null}
                <AvatarFallback className='bg-teal-100 text-[11px] text-teal-700'>
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <Box minWidth={0} grow={1}>
                <Text
                  as='div'
                  weight='medium'
                  leading='tight'
                  truncate
                  style={PRIMARY_LINE_STYLE}
                >
                  {userName}
                </Text>
                <Text
                  as='div'
                  color='muted-foreground'
                  leading='tight'
                  truncate
                  style={SECONDARY_LINE_STYLE}
                >
                  {userEmail}
                </Text>
              </Box>
              <Icon icon={ChevronsUpDown} size='sm' color='muted-foreground' />
            </FlexButton>
          </DropdownMenuTrigger>
          {/* className: DropdownMenuContent is a shadcn atom with no width prop. */}
          <DropdownMenuContent align='start' side='top' className='w-56'>
            <DropdownMenuItem asChild>
              <Link href='/profile'>
                <User />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href='/security'>
                <Shield />
                Account security
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onLogout?.()}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </VStack>
    </VStack>
  );
}

const AppSidebar = React.forwardRef<HTMLElement, AppSidebarProps>(
  AppSidebarInner
);

export { AppSidebar, DEFAULT_GROUPS };
