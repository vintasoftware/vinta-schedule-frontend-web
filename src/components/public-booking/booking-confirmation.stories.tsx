import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { CalendarEvent, CalendarEventWithManagementCodes } from '@/client';
import { BookingConfirmation } from './booking-confirmation';

const EVENT: CalendarEvent = {
  id: 1,
  title: 'Appointment',
  start_time: '2026-03-02T15:00:00.000Z',
  end_time: '2026-03-02T15:30:00.000Z',
  timezone: 'America/New_York',
  created: '2026-03-01T00:00:00.000Z',
  modified: '2026-03-01T00:00:00.000Z',
  external_id: 'evt-1',
  external_attendances: [],
  attendances: [],
  resource_allocations: [],
  group_selections: [],
  parent_recurring_object: {
    id: 0,
    title: '',
    external_id: '',
    start_time: '2026-03-01T00:00:00.000Z',
    end_time: '2026-03-01T00:00:00.000Z',
    created: '2026-03-01T00:00:00.000Z',
    modified: '2026-03-01T00:00:00.000Z',
  },
  is_recurring_instance: false,
  is_recurring: false,
};

const meta = {
  title: 'Components/PublicBooking/BookingConfirmation',
  component: BookingConfirmation,
  tags: ['autodocs'],
  args: {
    event: EVENT,
    timezone: 'America/New_York',
    scope: { kind: 'calendar' },
  },
} satisfies Meta<typeof BookingConfirmation>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * No `management` object on the event — an older backend's `201` (predating
 * API Phase 8) or a plain read. Degrades to the base confirmation only, with
 * no self-service section, rather than crashing.
 */
export const Default: Story = {};

// NOTE: these are illustrative placeholders, deliberately NOT shaped like a
// real minted code (no token-like entropy) — see the plan's "Do not put a
// plausible-looking real code in a story fixture" rule, upheld here for the
// same reason Phase 1's mint dialog story stops short of the reveal view.
const EVENT_WITH_MANAGEMENT: CalendarEventWithManagementCodes = {
  ...EVENT,
  management: {
    reschedule_code: 'story-placeholder-reschedule-not-a-real-code',
    cancel_code: 'story-placeholder-cancel-not-a-real-code',
  },
};

/**
 * A `201` carrying `management` renders both self-service links, built
 * through `buildBookingLinkUrl`, plus the plain "expires when your
 * appointment ends" statement.
 */
export const WithSelfServiceLinks: Story = {
  args: {
    event: EVENT_WITH_MANAGEMENT,
    scope: { kind: 'calendar' },
  },
};

/** A group-scoped confirmation's reschedule link carries `?target=group`
 * and no duration — the group's own server-pinned duration applies. */
export const WithSelfServiceLinksGroupScope: Story = {
  args: {
    event: EVENT_WITH_MANAGEMENT,
    scope: { kind: 'group' },
  },
};

/** Branded route — both links use the `/o/[slug]/...` prefix. */
export const WithSelfServiceLinksBranded: Story = {
  args: {
    event: EVENT_WITH_MANAGEMENT,
    scope: { kind: 'calendar' },
    slug: 'acme',
  },
};

// A realistic-length code (long enough to actually wrap at 375px, unlike the
// short placeholders above) — still an illustrative, non-token-shaped
// fixture per the "no token-like entropy" rule, just padded with readable
// words instead of random characters so it exercises the same wrap a real
// minted code's length would.
const EVENT_WITH_MANAGEMENT_LONG_CODE: CalendarEventWithManagementCodes = {
  ...EVENT,
  management: {
    reschedule_code:
      'story-placeholder-reschedule-code-long-enough-to-wrap-on-a-375px-mobile-viewport-not-a-real-code',
    cancel_code:
      'story-placeholder-cancel-code-long-enough-to-wrap-on-a-375px-mobile-viewport-not-a-real-code',
  },
};

/**
 * Mobile viewport (375px) with a realistic-length code — regression fixture
 * for the credential clipping behind a fixed `rows` textarea (measured
 * `scrollHeight` > `clientHeight` before the auto-grow fix). Confirms the
 * whole credential stays readable, not scrolled out of view, at the
 * narrowest supported width.
 */
export const WithSelfServiceLinksMobile: Story = {
  args: {
    event: EVENT_WITH_MANAGEMENT_LONG_CODE,
    scope: { kind: 'calendar' },
  },
  globals: { viewport: { value: 'mobile' } },
};
