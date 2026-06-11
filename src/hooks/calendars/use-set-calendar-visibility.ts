import { calendarPartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import type { VisibilityEnum } from '@/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useSetCalendarVisibility
//
// Wraps `calendarPartialUpdate` (PATCH /calendar/{id}/) to set the
// `visibility` field. Marking a calendar as `unlisted` hides it from
// listing/booking queries but keeps sync running for conflict detection;
// the opt-out survives re-import. Setting it back to `active` restores it.
//
// On success, invalidates all calendar-list queries so the table reflects
// the new state.
// ---------------------------------------------------------------------------

export function useSetCalendarVisibility() {
  const queryClient = useQueryClient();

  const setVisibilityMutation = useMutation({
    ...calendarPartialUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'calendarList',
      });
    },
  });

  const setVisibility = async (id: number, visibility: VisibilityEnum) =>
    setVisibilityMutation.mutateAsync({
      path: { id: String(id) },
      body: { visibility },
    });

  return { setVisibility, setVisibilityMutation };
}
