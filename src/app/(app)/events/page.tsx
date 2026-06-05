import { Suspense } from 'react';
import { Stack } from '@/components/layout/stack';
import { PageHeader } from '@/components/layout/page-header';
import { EventsView } from '@/components/events/events-view';

/**
 * EventsPage — member view of their calendar events.
 *
 * No admin gate: any authenticated member can see this route; the backend
 * scopes the event list to the calling member's calendars automatically.
 *
 * Renders the EventsView composition (agenda/list mode by default).
 * Interactive hooks/state live inside EventsView ('use client' boundary).
 *
 * IMPORTANT — Suspense boundary:
 * EventsView uses useSearchParams (Phase 15) to sync the calendar scope to
 * the URL. In Next.js 15+, any component that calls useSearchParams must be
 * rendered inside a <Suspense> boundary, otherwise the route will deopt to
 * full client-side rendering (and emit a build warning).
 */
export default function EventsPage() {
  return (
    <Stack gap={6}>
      <PageHeader title='Events' description='View your upcoming events.' />
      <Suspense fallback={null}>
        <EventsView />
      </Suspense>
    </Stack>
  );
}
