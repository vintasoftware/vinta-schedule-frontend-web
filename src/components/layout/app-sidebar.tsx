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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MyMembership } from '@/client';
import { OrgSwitcher } from '@/components/organizations/org-switcher';
import { Box } from './box';
import { VStack } from './flex';
import { Text } from './text';

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
      className={cn('border-sidebar-border border-r', className)}
      {...props}
    >
      {/* Brand */}
      <div className='border-sidebar-border flex h-16 items-center gap-2.5 border-b px-5'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src='/vinta-wordmark.svg'
          alt='Vinta'
          className='h-[19px] w-auto dark:brightness-0 dark:invert'
        />
        <Text
          weight='medium'
          color='muted-foreground'
          className='border-border border-l pl-2.5 text-[13px]'
        >
          Schedule
        </Text>
      </div>

      {/* Nav */}
      <VStack as='nav' grow={1} gap={5} px={3} py={4} overflow='auto'>
        {groups.map((group, i) => (
          <VStack
            key={group.label ?? i}
            className={cn('gap-0.5', i > 0 && 'mt-3')}
          >
            {group.label ? (
              <Text
                weight='semibold'
                uppercase
                color='muted-foreground'
                className='px-2.5 pb-1.5 text-[11px] tracking-[0.06em]'
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
              const Icon = item.icon;
              const itemContent = (
                <>
                  <Icon
                    className={cn(
                      'size-[17px]',
                      active ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <Text as='span' className='flex-1 text-left'>
                    {item.label}
                  </Text>
                  {item.badge != null ? (
                    <Text
                      as='span'
                      weight='semibold'
                      color='primary'
                      className='bg-vinta-50 rounded-full px-1.5 py-0.5 text-[11px]'
                    >
                      {item.badge}
                    </Text>
                  ) : null}
                </>
              );
              const itemClass = cn(
                'group flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              );
              if (item.href) {
                return (
                  <Link key={item.id} href={item.href} className={itemClass}>
                    {itemContent}
                  </Link>
                );
              }
              return (
                <button
                  key={item.id}
                  type='button'
                  onClick={() => onNavigate?.(item.id)}
                  className={itemClass}
                >
                  {itemContent}
                </button>
              );
            })}
          </VStack>
        ))}
      </VStack>

      {/* Org + user */}
      <VStack gap={1} p={3} className='border-sidebar-border border-t'>
        <button
          type='button'
          onClick={toggleTheme}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          className='hover:bg-sidebar-accent flex h-9 items-center gap-2.5 rounded-md px-2.5 text-left transition-colors'
        >
          {isDark ? (
            <Sun className='text-muted-foreground size-[17px]' />
          ) : (
            <Moon className='text-muted-foreground size-[17px]' />
          )}
          <Text as='span' className='text-[13px]'>
            {isDark ? 'Light mode' : 'Dark mode'}
          </Text>
        </button>
        {memberships && memberships.length >= 1 && onSelectOrg ? (
          <OrgSwitcher
            memberships={memberships}
            activeOrgId={activeOrgId ?? null}
            onSelect={onSelectOrg}
            onCreateOrg={onCreateOrg}
          />
        ) : (
          <button
            type='button'
            className='hover:bg-sidebar-accent flex h-11 items-center gap-2.5 rounded-md px-2.5 text-left transition-colors'
          >
            <Box
              width={28}
              height={28}
              radius='md'
              bg='vinta-600'
              shrink={0}
              className='flex items-center justify-center text-[13px] font-bold text-white'
            >
              {orgName.charAt(0)}
            </Box>
            <Box minWidth={0} grow={1}>
              <Text
                as='div'
                weight='semibold'
                leading='tight'
                truncate
                className='text-[13px]'
              >
                {orgName}
              </Text>
              <Text
                as='div'
                color='muted-foreground'
                leading='tight'
                className='text-[11px]'
              >
                {orgMeta}
              </Text>
            </Box>
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type='button'
              aria-label='Account menu'
              className='hover:bg-sidebar-accent flex h-11 items-center gap-2.5 rounded-md px-2.5 text-left transition-colors'
            >
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
                  className='text-[13px]'
                >
                  {userName}
                </Text>
                <Text
                  as='div'
                  color='muted-foreground'
                  leading='tight'
                  truncate
                  className='text-[11px]'
                >
                  {userEmail}
                </Text>
              </Box>
              <ChevronsUpDown className='text-muted-foreground size-[15px]' />
            </button>
          </DropdownMenuTrigger>
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
