'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import type { MyMembership } from '@/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'vinta-schedule-design-system/ui/dropdown-menu';
import {
  Box,
  Center,
  Flex,
  Text,
  type FlexProps,
} from 'vinta-schedule-design-system/layout';
import { Icon } from 'vinta-schedule-design-system/ui/icon';

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

// <Flex as='button'> renders a real <button>, but FlexProps is typed against the
// generic HTMLAttributes set, so `type` is not in it. Widen the component once
// here (same trick the DS itself uses for <FormLayout>'s <form>).
const FlexButton = Flex as unknown as React.ForwardRefExoticComponent<
  FlexProps &
    React.ButtonHTMLAttributes<HTMLButtonElement> &
    React.RefAttributes<HTMLElement>
>;

// TODO(ds-gap): the sidebar row metrics (10px gap / inline padding) sit off the
// 4px Space scale, and Text has no font-size token for 13px / 11px. They are
// carried as token-free inline values rather than as utility classes.
const TRIGGER_STYLE: React.CSSProperties = {
  gap: '0.625rem',
  paddingInline: '0.625rem',
};
const NAME_STYLE: React.CSSProperties = { fontSize: '13px' };
const META_STYLE: React.CSSProperties = { fontSize: '11px' };
const AVATAR_STYLE: React.CSSProperties = { fontSize: '13px', fontWeight: 700 };
const MENU_AVATAR_STYLE: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
};
const MENU_NAME_STYLE: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: 1,
};
const MENU_META_STYLE: React.CSSProperties = {
  fontSize: '11px',
  lineHeight: 1,
};
const CHECK_STYLE: React.CSSProperties = { marginLeft: 'auto' };

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
        <FlexButton
          as='button'
          type='button'
          align='center'
          width='full'
          height={44}
          radius='md'
          textAlign='left'
          style={TRIGGER_STYLE}
          // className: :hover surfaces and transitions have no DS prop.
          className='hover:bg-sidebar-accent transition-colors'
        >
          <Center
            width={28}
            height={28}
            radius='md'
            bg='vinta-600'
            color='#ffffff'
            shrink={0}
            style={AVATAR_STYLE}
          >
            {activeOrgName.charAt(0)}
          </Center>
          <Box minWidth={0} grow={1}>
            <Text
              as='div'
              weight='semibold'
              leading='tight'
              truncate
              style={NAME_STYLE}
            >
              {activeOrgName}
            </Text>
            <Text
              as='div'
              color='muted-foreground'
              leading='tight'
              style={META_STYLE}
            >
              {roleLabel(activeRole)}
            </Text>
          </Box>
          <Icon icon={ChevronsUpDown} size='sm' color='muted-foreground' />
        </FlexButton>
      </DropdownMenuTrigger>
      {/* className: DropdownMenuContent is a shadcn atom with no width prop. */}
      <DropdownMenuContent align='start' side='top' className='w-56'>
        {memberships.map((m) => {
          const isActive = String(m.organization.id) === activeOrgId;
          return (
            <DropdownMenuItem
              key={m.organization.id}
              onSelect={() => !isActive && onSelect(String(m.organization.id))}
            >
              <Center
                width={20}
                height={20}
                radius='sm'
                bg='vinta-600'
                color='#ffffff'
                shrink={0}
                style={MENU_AVATAR_STYLE}
              >
                {m.organization.name.charAt(0)}
              </Center>
              <Box minWidth={0} grow={1}>
                <Text as='div' weight='medium' truncate style={MENU_NAME_STYLE}>
                  {m.organization.name}
                </Text>
                <Text as='div' color='muted-foreground' style={MENU_META_STYLE}>
                  {roleLabel(m.role)}
                </Text>
              </Box>
              {isActive ? (
                <Icon icon={Check} color='primary' style={CHECK_STYLE} />
              ) : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!onCreateOrg}
          onSelect={() => onCreateOrg?.()}
        >
          <Plus />
          New organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
