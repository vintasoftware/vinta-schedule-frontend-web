/**
 * useDownloadEventIcs — download a calendar event as an iCalendar (.ics) file.
 *
 * Wraps `calendarEventsIcsRetrieve` (GET /calendar-events/{id}/ics/), which the
 * backend serves in RFC 5545 format with timezone, recurrence, and attendee
 * data. The endpoint returns binary content, so we force `parseAs: 'blob'` (the
 * client's content-type sniffing would otherwise treat `text/calendar` as text)
 * and hand the resulting Blob to `downloadBlob`, which triggers a browser save.
 *
 * Modelled as a mutation rather than a query: downloading is an imperative,
 * side-effecting action fired from a button click — there is nothing to cache or
 * re-render. Auth and the `X-Organization-Id` header are injected by the shared
 * request interceptors, so callers only pass the event id (and an optional
 * filename).
 */

import { useMutation } from '@tanstack/react-query';
import { calendarEventsIcsRetrieve } from '@/client/sdk.gen';
import { downloadBlob, slugifyFilename } from '@/lib/utils/download-blob';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DownloadEventIcsInput {
  /** The numeric event id (path parameter). */
  eventId: number;
  /**
   * Optional human title used to name the file (slugified, `.ics` appended).
   * Defaults to `event-<id>` when omitted or empty.
   */
  title?: string;
}

// ---------------------------------------------------------------------------
// useDownloadEventIcs
// ---------------------------------------------------------------------------

export function useDownloadEventIcs() {
  const downloadEventIcsMutation = useMutation({
    mutationFn: async ({ eventId, title }: DownloadEventIcsInput) => {
      const { data } = await calendarEventsIcsRetrieve({
        path: { id: String(eventId) },
        parseAs: 'blob',
        throwOnError: true,
      });

      const baseName = title
        ? slugifyFilename(title, `event-${eventId}`)
        : `event-${eventId}`;
      downloadBlob(data as Blob, `${baseName}.ics`);
    },
  });

  /**
   * Download the event's ICS file.
   *
   * @param eventId - The numeric event id.
   * @param title - Optional title to derive the filename from.
   */
  const downloadEventIcs = async (eventId: number, title?: string) =>
    downloadEventIcsMutation.mutateAsync({ eventId, title });

  return { downloadEventIcs, downloadEventIcsMutation };
}
