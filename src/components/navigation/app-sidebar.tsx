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
  Sidebar,
  SidebarGroup,
  SidebarItem,
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
// TODO(ds-gap): the two-line footer rows (static org button, account menu
// trigger) have no DS primitive — <SidebarItem> is a single-line label/icon/badge
// row, so an avatar + name + meta row still has to be hand-rolled from
// Flex/Center/Text here. A `<SidebarProfileRow avatar={…} primary={…}
// secondary={…} trailingIconName={…}>` (or a `SidebarItem` that accepts
// `secondaryLabel` + a leading slot) would delete the rest of this file.
//
// The remaining local constants exist because:
//   * :hover surfaces + `transition-colors` have no prop (pseudo-classes cannot
//     be expressed inline) — HOVER_ROW_CLASS;
//   * this design's 10px gaps and 13px/11px font sizes fall between the Space
//     and Text token steps.
// ---------------------------------------------------------------------------
const BRAND_STYLE: React.CSSProperties = { gap: '0.625rem' };
const BRAND_WORDMARK_STYLE: React.CSSProperties = {
  borderLeft: '1px solid var(--border)',
  paddingLeft: '0.625rem',
  fontSize: '13px',
};
const FOOTER_ROW_STYLE: React.CSSProperties = {
  gap: '0.625rem',
  paddingInline: '0.625rem',
};
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

/** Top of the rail: the wordmark + product name. */
const BRAND = (
  <HStack align='center' style={BRAND_STYLE}>
    {/* className: a `dark:` filter (invert the wordmark) has no DS prop. */}
    <Image
      src='/vinta-wordmark.svg'
      alt='Vinta'
      height={19}
      width='auto'
      fit='contain'
      className='dark:brightness-0 dark:invert'
    />
    <Text weight='medium' color='muted-foreground' style={BRAND_WORDMARK_STYLE}>
      Schedule
    </Text>
  </HStack>
);

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

  const footer = (
    <VStack gap={1}>
      <SidebarItem
        label={isDark ? 'Light mode' : 'Dark mode'}
        icon={isDark ? Sun : Moon}
        onClick={toggleTheme}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      />
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
  );

  return (
    <Sidebar ref={ref} width={244} brand={BRAND} footer={footer} {...props}>
      {groups.map((group, i) => (
        <SidebarGroup key={group.label ?? i} label={group.label}>
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
              // asChild: the Link becomes the row element (a real <a> with
              // client-side routing) and the icon/label/badge render inside it.
              return (
                <SidebarItem
                  key={item.id}
                  asChild
                  label={item.label}
                  icon={item.icon}
                  badge={item.badge}
                  active={active}
                >
                  <Link href={item.href} />
                </SidebarItem>
              );
            }
            return (
              <SidebarItem
                key={item.id}
                label={item.label}
                icon={item.icon}
                badge={item.badge}
                active={active}
                onClick={() => onNavigate?.(item.id)}
              />
            );
          })}
        </SidebarGroup>
      ))}
    </Sidebar>
  );
}

const AppSidebar = React.forwardRef<HTMLElement, AppSidebarProps>(
  AppSidebarInner
);

export { AppSidebar, DEFAULT_GROUPS };
