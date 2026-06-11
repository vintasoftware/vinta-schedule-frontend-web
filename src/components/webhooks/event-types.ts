import type { EventTypeEnum } from '@/client';

/** All webhook event types with human-readable labels. */
export const WEBHOOK_EVENT_TYPES: {
  value: EventTypeEnum;
  label: string;
}[] = [
  { value: 'calendar_event_created', label: 'Event created' },
  { value: 'calendar_event_updated', label: 'Event updated' },
  { value: 'calendar_event_deleted', label: 'Event deleted' },
  { value: 'calendar_event_attendee_added', label: 'Attendee added' },
  { value: 'calendar_event_attendee_removed', label: 'Attendee removed' },
  { value: 'calendar_event_attendee_updated', label: 'Attendee updated' },
];

const LABEL_BY_VALUE = new Map(
  WEBHOOK_EVENT_TYPES.map((t) => [t.value, t.label])
);

/** Label for an event type, falling back to the raw value. */
export function eventTypeLabel(value: EventTypeEnum | undefined): string {
  if (!value) return '—';
  return LABEL_BY_VALUE.get(value) ?? value;
}
