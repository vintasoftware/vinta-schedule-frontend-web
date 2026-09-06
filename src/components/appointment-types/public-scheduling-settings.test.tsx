import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AppointmentType } from '@/client';
import { PublicSchedulingSettings } from './public-scheduling-settings';
import * as permissionGateModule from '@/components/navigation/permission-gate';
import * as updateHookModule from '@/hooks/appointment-types/use-update-appointment-type-public-scheduling';
import * as orgHookModule from '@/hooks/organizations/use-current-organization';

type UpdateHookMock = ReturnType<
  typeof updateHookModule.useUpdateAppointmentTypePublicScheduling
>;

function mockUpdateHook(
  updatePublicScheduling: ReturnType<typeof vi.fn>,
  isPending = false
) {
  vi.spyOn(
    updateHookModule,
    'useUpdateAppointmentTypePublicScheduling'
  ).mockReturnValue({
    updatePublicScheduling,
    updatePublicSchedulingMutation: { isPending },
  } as unknown as UpdateHookMock);
}

function mockAdmin(isAdmin: boolean) {
  vi.spyOn(permissionGateModule, 'useHasPermission').mockReturnValue(isAdmin);
}

/** Same helper shape as `mint-booking-link-dialog.test.tsx`'s `mockOrgSlug`
 * — resolves the active org's slug for the branded public link URL. */
function mockOrgSlug(slug: string | undefined) {
  vi.spyOn(orgHookModule, 'useCurrentOrganization').mockReturnValue({
    organization: slug ? { slug } : null,
    isOnboarded: true,
    isGated: false,
    isDisabled: false,
    membership: null,
    permissions: [],
    isLoading: false,
    isError: false,
    error: null,
    query: { data: undefined },
  } as unknown as ReturnType<typeof orgHookModule.useCurrentOrganization>);
}

beforeAll(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

function renderSettings(appointmentType: AppointmentType) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(
    <PublicSchedulingSettings appointmentType={appointmentType} />,
    { wrapper }
  );
}

/** A pool holding one calendar, so the slot below has both roster sources. */
const POOL_SURGEONS = {
  id: 7,
  name: 'Surgeons',
  description: '',
  calendars: [
    {
      id: 100,
      name: 'Dr. Smith',
      email: 'smith@example.com',
      external_id: 'ext-100',
      provider: 'google',
      calendar_type: 'personal',
    },
  ],
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
} as AppointmentType['slots'][number]['pools'][number];

/** The writable form of the fixture's slot — what every PATCH must carry. */
const SLOT_WRITABLE = {
  name: 'Surgeon',
  description: '',
  order: 0,
  required_count: 1,
  // Dr. Smith comes from the pool, so it stays in `pool_ids` and must NOT be
  // promoted into `calendar_ids`.
  calendar_ids: [101],
  pool_ids: [7],
};

function makeAppointmentType(
  overrides: Partial<AppointmentType> = {}
): AppointmentType {
  return {
    id: 1,
    name: 'Surgery Team',
    description: 'Operating room coverage',
    slots: [
      {
        id: 10,
        name: 'Surgeon',
        required_count: 1,
        calendars: [
          POOL_SURGEONS.calendars[0],
          {
            id: 101,
            name: 'Dr. Lee',
            email: 'lee@example.com',
            external_id: 'ext-101',
            provider: 'google',
            calendar_type: 'personal',
          },
        ],
        pools: [POOL_SURGEONS],
      },
    ],
    public_booking_slug: 'surgery-team',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    ...overrides,
  } as AppointmentType;
}

/**
 * The fields every appointment type PATCH must carry regardless of what changed — a
 * partial update that omits `slots` is refused outright, and an omitted
 * `description` is silently cleared.
 */
const ALWAYS_SENT = {
  name: 'Surgery Team',
  description: 'Operating room coverage',
  slots: [SLOT_WRITABLE],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('PublicSchedulingSettings — admin: single PATCH with both fields', () => {
  it('issues one PATCH carrying both the toggle and the duration, with no null', async () => {
    const user = userEvent.setup();
    mockAdmin(true);
    const updatePublicScheduling = vi.fn().mockResolvedValue({});
    mockUpdateHook(updatePublicScheduling);

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: false,
        duration: undefined,
      })
    );

    await user.click(
      screen.getByRole('switch', { name: 'Accept public bookings' })
    );
    const durationInput = screen.getByRole('spinbutton', {
      name: 'Appointment length in minutes',
    });
    await user.clear(durationInput);
    await user.type(durationInput, '30');

    await user.click(screen.getByTestId('save-public-scheduling-settings'));

    await waitFor(() => {
      expect(updatePublicScheduling).toHaveBeenCalledTimes(1);
    });
    expect(updatePublicScheduling).toHaveBeenCalledWith({
      ...ALWAYS_SENT,
      accepts_public_scheduling: true,
      duration: '00:30:00',
    });
    // Guard the tri-state contract directly: never an explicit null.
    const body = updatePublicScheduling.mock.calls[0][0];
    expect(Object.values(body)).not.toContain(null);
  });
});

describe('PublicSchedulingSettings — the body is never slots-less', () => {
  it('carries name, description and the full slot list, so the server does not refuse the write', async () => {
    // Regression: this panel used to PATCH only the two public-scheduling
    // fields. `AppointmentTypeSerializer` refuses a partial update that omits
    // `slots` — reading the absence as "no slots" would delete every slot and
    // every pool attachment with it — so that body never landed at all.
    const user = userEvent.setup();
    mockAdmin(true);
    const updatePublicScheduling = vi.fn().mockResolvedValue({});
    mockUpdateHook(updatePublicScheduling);

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: false,
        duration: '00:30:00',
      })
    );

    await user.click(
      screen.getByRole('switch', { name: 'Accept public bookings' })
    );
    await user.click(screen.getByTestId('save-public-scheduling-settings'));

    await waitFor(() => {
      expect(updatePublicScheduling).toHaveBeenCalledTimes(1);
    });

    const body = updatePublicScheduling.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(body.name).toBe('Surgery Team');
    expect(body.description).toBe('Operating room coverage');
    expect(body.slots).toEqual([SLOT_WRITABLE]);
  });

  it('keeps a pool calendar in pool_ids rather than promoting it to an inline member', async () => {
    // Round-tripping the slot must not turn pool-derived calendars into inline
    // ones — that would survive the pool being detached later and quietly
    // widen the roster.
    const user = userEvent.setup();
    mockAdmin(true);
    const updatePublicScheduling = vi.fn().mockResolvedValue({});
    mockUpdateHook(updatePublicScheduling);

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: false,
        duration: '00:30:00',
      })
    );

    await user.click(
      screen.getByRole('switch', { name: 'Accept public bookings' })
    );
    await user.click(screen.getByTestId('save-public-scheduling-settings'));

    await waitFor(() => {
      expect(updatePublicScheduling).toHaveBeenCalledTimes(1);
    });

    const slots = (
      updatePublicScheduling.mock.calls[0][0] as {
        slots: { calendar_ids: number[]; pool_ids: number[] }[];
      }
    ).slots;
    // Dr. Smith (100) is the pool's; Dr. Lee (101) is the inline pick.
    expect(slots[0].calendar_ids).toEqual([101]);
    expect(slots[0].pool_ids).toEqual([7]);
  });
});

describe('PublicSchedulingSettings — unrelated edit omits the unchanged field', () => {
  it('keeps duration omitted (not resent) when only the toggle changes', async () => {
    const user = userEvent.setup();
    mockAdmin(true);
    const updatePublicScheduling = vi.fn().mockResolvedValue({});
    mockUpdateHook(updatePublicScheduling);

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: true,
        duration: '00:45:00',
      })
    );

    // Unrelated edit: flip the toggle off, never touch the duration input.
    await user.click(
      screen.getByRole('switch', { name: 'Accept public bookings' })
    );
    await user.click(screen.getByTestId('save-public-scheduling-settings'));

    await waitFor(() => {
      expect(updatePublicScheduling).toHaveBeenCalledTimes(1);
    });
    expect(updatePublicScheduling).toHaveBeenCalledWith({
      ...ALWAYS_SENT,
      accepts_public_scheduling: false,
    });
    const body = updatePublicScheduling.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect('duration' in body).toBe(false);
  });
});

describe('PublicSchedulingSettings — enabling with no duration is blocked client-side', () => {
  it('never calls the PATCH when enabling without a duration', async () => {
    const user = userEvent.setup();
    mockAdmin(true);
    const updatePublicScheduling = vi.fn().mockResolvedValue({});
    mockUpdateHook(updatePublicScheduling);

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: false,
        duration: undefined,
      })
    );

    await user.click(
      screen.getByRole('switch', { name: 'Accept public bookings' })
    );
    // Duration left at its unset default (0) — do not touch the input.
    await user.click(screen.getByTestId('save-public-scheduling-settings'));

    await waitFor(() => {
      expect(
        screen.getByText(/Set an appointment length before enabling/)
      ).toBeInTheDocument();
    });
    expect(updatePublicScheduling).not.toHaveBeenCalled();
  });
});

describe('PublicSchedulingSettings — non-admin read-only', () => {
  it('renders the controls disabled and offers no save action', () => {
    mockAdmin(false);
    mockUpdateHook(vi.fn());

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: true,
        duration: '00:30:00',
      })
    );

    expect(
      screen.getByRole('switch', { name: 'Accept public bookings' })
    ).toBeDisabled();
    expect(
      screen.getByRole('spinbutton', {
        name: 'Appointment length in minutes',
      })
    ).toBeDisabled();
    expect(
      screen.queryByTestId('save-public-scheduling-settings')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Only an organization admin can change these settings.')
    ).toBeInTheDocument();
  });
});

describe('PublicSchedulingSettings — unsaved edit survives an appointment-type-prop refetch', () => {
  it('does not wipe an in-progress edit when `appointment type` changes reference with the same values', async () => {
    const user = userEvent.setup();
    mockAdmin(true);
    mockUpdateHook(vi.fn().mockResolvedValue({}));

    const appointmentType = makeAppointmentType({
      accepts_public_scheduling: true,
      duration: '00:30:00',
    });
    const { rerender } = renderSettings(appointmentType);

    const durationInput = screen.getByRole('spinbutton', {
      name: 'Appointment length in minutes',
    });
    await user.clear(durationInput);
    await user.type(durationInput, '45');
    expect(durationInput).toHaveValue(45);

    // Simulate a background refetch landing mid-edit: a new `appointment type` object
    // reference (e.g. from an unrelated invalidated query) with unchanged
    // server values.
    const refetchedAppointmentType = makeAppointmentType({
      accepts_public_scheduling: true,
      duration: '00:30:00',
    });
    rerender(
      <PublicSchedulingSettings appointmentType={refetchedAppointmentType} />
    );

    expect(durationInput).toHaveValue(45);
  });
});

describe('PublicSchedulingSettings — failure path surfaces on the form root', () => {
  it('surfaces a bare {detail} rejection through FormRootMessage, not just a toast', async () => {
    const user = userEvent.setup();
    mockAdmin(true);
    const updatePublicScheduling = vi
      .fn()
      .mockRejectedValueOnce({ detail: 'You do not have permission.' });
    mockUpdateHook(updatePublicScheduling);

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: true,
        duration: '00:30:00',
      })
    );

    const durationInput = screen.getByRole('spinbutton', {
      name: 'Appointment length in minutes',
    });
    await user.clear(durationInput);
    await user.type(durationInput, '45');
    await user.click(screen.getByTestId('save-public-scheduling-settings'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission.'
    );
  });
});

describe('PublicSchedulingSettings — two sequential saves without an intervening refetch', () => {
  it('diffs the second save against the just-saved values, not the original appointment type prop', async () => {
    const user = userEvent.setup();
    mockAdmin(true);
    const updatePublicScheduling = vi.fn().mockResolvedValue({});
    mockUpdateHook(updatePublicScheduling);

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: false,
        duration: undefined,
      })
    );

    // First save: enable + set a duration.
    await user.click(
      screen.getByRole('switch', { name: 'Accept public bookings' })
    );
    const durationInput = screen.getByRole('spinbutton', {
      name: 'Appointment length in minutes',
    });
    await user.clear(durationInput);
    await user.type(durationInput, '30');
    await user.click(screen.getByTestId('save-public-scheduling-settings'));

    await waitFor(() => {
      expect(updatePublicScheduling).toHaveBeenCalledTimes(1);
    });
    expect(updatePublicScheduling).toHaveBeenNthCalledWith(1, {
      ...ALWAYS_SENT,
      accepts_public_scheduling: true,
      duration: '00:30:00',
    });

    // Second save: only the duration changes. The `appointment type` prop itself never
    // changes (no intervening refetch), so the diff must come from
    // `savedValues`, not the original prop — otherwise the toggle (already
    // true, unchanged since the first save) would be wrongly resent.
    await user.clear(durationInput);
    await user.type(durationInput, '45');
    await user.click(screen.getByTestId('save-public-scheduling-settings'));

    await waitFor(() => {
      expect(updatePublicScheduling).toHaveBeenCalledTimes(2);
    });
    const secondBody = updatePublicScheduling.mock.calls[1][0] as Record<
      string,
      unknown
    >;
    expect(secondBody).toEqual({ ...ALWAYS_SENT, duration: '00:45:00' });
    expect('accepts_public_scheduling' in secondBody).toBe(false);
    expect(Object.values(secondBody)).not.toContain(null);
  });
});

describe('PublicSchedulingSettings — grandfathered null-duration public appointment type', () => {
  it('renders a warning instead of presenting the appointment type as healthy', () => {
    mockAdmin(true);
    mockUpdateHook(vi.fn());

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: true,
        duration: undefined,
      })
    );

    expect(
      screen.getByTestId('grandfathered-duration-warning')
    ).toBeInTheDocument();
  });

  it('does not render the warning for a healthy public appointment type with a duration', () => {
    mockAdmin(true);
    mockUpdateHook(vi.fn());

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: true,
        duration: '00:30:00',
      })
    );

    expect(
      screen.queryByTestId('grandfathered-duration-warning')
    ).not.toBeInTheDocument();
  });

  it('does not render the warning for a private appointment type with no duration', () => {
    mockAdmin(true);
    mockUpdateHook(vi.fn());

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: false,
        duration: undefined,
      })
    );

    expect(
      screen.queryByTestId('grandfathered-duration-warning')
    ).not.toBeInTheDocument();
  });
});

describe('PublicSchedulingSettings — Phase 7: the reusable public link', () => {
  it('renders the bare /g/[public_slug] link when no active org slug is known', () => {
    mockAdmin(true);
    mockUpdateHook(vi.fn());
    mockOrgSlug(undefined);

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: true,
        duration: '00:30:00',
        public_booking_slug: 'surgery-team',
      })
    );

    const input = screen.getByTestId(
      'public-appointment-type-link-input'
    ) as HTMLInputElement;
    expect(input.value).toBe('http://localhost:3000/g/surgery-team');
  });

  it('renders the branded /o/[slug]/g/[public_slug] link when the active org slug is known', () => {
    mockAdmin(true);
    mockUpdateHook(vi.fn());
    mockOrgSlug('acme');

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: true,
        duration: '00:30:00',
        public_booking_slug: 'surgery-team',
      })
    );

    const input = screen.getByTestId(
      'public-appointment-type-link-input'
    ) as HTMLInputElement;
    expect(input.value).toBe('http://localhost:3000/o/acme/g/surgery-team');
  });

  it('is visible for a non-admin, read-only viewer too — it is not gated behind manage-members', () => {
    mockAdmin(false);
    mockUpdateHook(vi.fn());
    mockOrgSlug(undefined);

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: true,
        duration: '00:30:00',
      })
    );

    expect(
      screen.getByTestId('public-appointment-type-link-card')
    ).toBeInTheDocument();
  });

  it('says the link is inactive when public scheduling is off, without hiding it', () => {
    mockAdmin(true);
    mockUpdateHook(vi.fn());
    mockOrgSlug(undefined);

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: false,
        duration: undefined,
      })
    );

    expect(
      screen.getByTestId('public-appointment-type-link-inactive-toggle')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('public-appointment-type-link-input')
    ).toBeInTheDocument();
  });

  it('says the link is inactive for a grandfathered public-but-duration-unset appointment type', () => {
    mockAdmin(true);
    mockUpdateHook(vi.fn());
    mockOrgSlug(undefined);

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: true,
        duration: undefined,
      })
    );

    expect(
      screen.getByTestId('public-appointment-type-link-inactive-duration')
    ).toBeInTheDocument();
  });

  it('shows neither inactive notice for a healthy public appointment type with a duration set', () => {
    mockAdmin(true);
    mockUpdateHook(vi.fn());
    mockOrgSlug(undefined);

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: true,
        duration: '00:30:00',
      })
    );

    expect(
      screen.queryByTestId('public-appointment-type-link-inactive-toggle')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('public-appointment-type-link-inactive-duration')
    ).not.toBeInTheDocument();
  });

  it('copies the reusable link to the clipboard and flips the icon Copy -> CheckCheck -> Copy after 2s', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      writable: true,
      configurable: true,
    });
    mockAdmin(true);
    mockUpdateHook(vi.fn());
    mockOrgSlug(undefined);

    renderSettings(
      makeAppointmentType({
        accepts_public_scheduling: true,
        duration: '00:30:00',
        public_booking_slug: 'surgery-team',
      })
    );

    const copyButton = screen.getByTestId(
      'copy-public-appointment-type-link-button'
    );
    expect(copyButton.querySelector('.lucide-copy')).toBeInTheDocument();

    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(copyButton);
        // Flush the awaited `navigator.clipboard.writeText` microtask so
        // `setCopied(true)` (and the `setTimeout` it schedules) has run —
        // same pattern as `booking-confirmation.test.tsx`'s identical test.
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(writeTextSpy).toHaveBeenCalledWith(
        'http://localhost:3000/g/surgery-team'
      );
      expect(
        copyButton.querySelector('.lucide-check-check')
      ).toBeInTheDocument();
      expect(copyButton.querySelector('.lucide-copy')).not.toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(copyButton.querySelector('.lucide-copy')).toBeInTheDocument();
      expect(
        copyButton.querySelector('.lucide-check-check')
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
