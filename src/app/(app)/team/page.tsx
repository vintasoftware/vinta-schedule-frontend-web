'use client';

import * as React from 'react';
import { Stack } from 'vinta-schedule-design-system/layout/stack';
import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { TeamTable } from '@/components/team/team-table';
import { InvitationsTable } from '@/components/invitations/invitations-table';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from 'vinta-schedule-design-system/ui/tabs';
import { useRequireRole } from '@/components/navigation/role-gate';

/**
 * TeamPage — admin-only view of all org members and pending invitations.
 *
 * Guarded by useRequireRole('admin'): a member who somehow reaches this URL is
 * redirected to '/' (degrade-don't-loop rule — never redirect back into (app)).
 *
 * Renders two tabs:
 * - Team: members in the organization
 * - Invitations: pending invitations (not yet accepted)
 */
export default function TeamPage() {
  // Gate: redirect non-admins out. The redirect fires in a useEffect, so
  // we also check isAllowed before rendering the tables to avoid firing the
  // API call and rendering sensitive data before the redirect effect runs.
  const { isAllowed } = useRequireRole('admin');

  if (!isAllowed) return null;

  return (
    <Stack gap={6}>
      <PageHeader
        title='Team'
        description='Manage your organization members and invitations.'
      />
      <Tabs defaultValue='team' className='w-full'>
        <TabsList>
          <TabsTrigger value='team'>Team</TabsTrigger>
          <TabsTrigger value='invitations'>Invitations</TabsTrigger>
        </TabsList>
        <TabsContent value='team'>
          <DataTableQueryBoundary>
            <TeamTable />
          </DataTableQueryBoundary>
        </TabsContent>
        <TabsContent value='invitations'>
          <DataTableQueryBoundary>
            <InvitationsTable />
          </DataTableQueryBoundary>
        </TabsContent>
      </Tabs>
    </Stack>
  );
}
