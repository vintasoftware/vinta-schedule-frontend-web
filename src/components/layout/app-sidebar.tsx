'use client';

import * as React from 'react';
import {
  Calendar,
  CalendarSync,
  ChevronsUpDown,
  ListChecks,
  LogOut,
  Settings,
  Ticket,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils/index';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Box } from './box';
import { VStack } from './flex';
import { Text } from './text';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
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
}

const AppSidebar = React.forwardRef<HTMLElement, AppSidebarProps>(
  function AppSidebar(
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
      ...props
    },
    ref
  ) {
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
                const active = item.id === activeId;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type='button'
                    onClick={() => onNavigate?.(item.id)}
                    className={cn(
                      'group flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent'
                    )}
                  >
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
            <ChevronsUpDown className='text-muted-foreground size-[15px]' />
          </button>
          <button
            type='button'
            className='hover:bg-sidebar-accent flex h-11 items-center gap-2.5 rounded-md px-2.5 text-left transition-colors'
          >
            <Avatar className='size-7'>
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
            <LogOut className='text-muted-foreground size-[15px]' />
          </button>
        </VStack>
      </VStack>
    );
  }
);

export { AppSidebar, DEFAULT_GROUPS };
