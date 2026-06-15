'use client';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import type { MyMembership } from '@/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Box } from '@/components/layout/box';
import { Text } from '@/components/layout/text';

// ---------------------------------------------------------------------------
// OrgSwitcher
//
// Presentational dropdown that lets a user switch between multiple organizations.
// Renders as:
//   - Trigger: the active org avatar initial + org name + role + chevron
//   - Content: a list of each membership (name + role), active one gets a check,
//     then a separator and "+ New organization" if onCreateOrg is provided
//     (or a disabled item when the prop is absent, as Phase 5 will wire it).
//
// Props are entirely static — no data hooks. The caller (app-layout-client.tsx)
// is responsible for fetching and passing membership data.
// ---------------------------------------------------------------------------

export interface OrgSwitcherProps {
  memberships: MyMembership[];
  activeOrgId: string | null;
  onSelect: (orgId: string) => void;
  onCreateOrg?: () => void;
}

export function OrgSwitcher({
  memberships,
  activeOrgId,
  onSelect,
  onCreateOrg,
}: OrgSwitcherProps) {
  const activeMembership =
    memberships.find((m) => String(m.organization.id) === activeOrgId) ?? null;

  const activeOrgName = activeMembership?.organization.name ?? 'Organization';
  const activeRole = activeMembership?.role ?? 'member';

  // Capitalise the role label for display: "admin" → "Admin"
  const roleLabel = (role: string) =>
    role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className='hover:bg-sidebar-accent flex h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left transition-colors'
        >
          <Box
            width={28}
            height={28}
            radius='md'
            bg='vinta-600'
            shrink={0}
            className='flex items-center justify-center text-[13px] font-bold text-white'
          >
            {activeOrgName.charAt(0)}
          </Box>
          <Box minWidth={0} grow={1}>
            <Text
              as='div'
              weight='semibold'
              leading='tight'
              truncate
              className='text-[13px]'
            >
              {activeOrgName}
            </Text>
            <Text
              as='div'
              color='muted-foreground'
              leading='tight'
              className='text-[11px]'
            >
              {roleLabel(activeRole)}
            </Text>
          </Box>
          <ChevronsUpDown className='text-muted-foreground size-[15px] shrink-0' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' side='top' className='w-56'>
        {memberships.map((m) => {
          const isActive = String(m.organization.id) === activeOrgId;
          return (
            <DropdownMenuItem
              key={m.organization.id}
              onSelect={() => !isActive && onSelect(String(m.organization.id))}
              className='flex items-center gap-2'
            >
              <Box
                width={20}
                height={20}
                radius='sm'
                bg='vinta-600'
                shrink={0}
                className='flex items-center justify-center text-[10px] font-bold text-white'
              >
                {m.organization.name.charAt(0)}
              </Box>
              <Box minWidth={0} grow={1}>
                <Text
                  as='div'
                  weight='medium'
                  truncate
                  className='text-[13px] leading-none'
                >
                  {m.organization.name}
                </Text>
                <Text
                  as='div'
                  color='muted-foreground'
                  className='text-[11px] leading-none'
                >
                  {roleLabel(m.role)}
                </Text>
              </Box>
              {isActive ? (
                <Check className='text-primary ml-auto size-4 shrink-0' />
              ) : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!onCreateOrg}
          onSelect={() => onCreateOrg?.()}
        >
          <Plus className='size-4' />
          New organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
