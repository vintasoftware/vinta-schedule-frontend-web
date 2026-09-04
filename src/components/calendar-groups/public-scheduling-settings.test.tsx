import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { CalendarGroup } from '@/client';
import { PublicSchedulingSettings } from './public-scheduling-settings';
import * as permissionGateModule from '@/components/navigation/permission-gate';
import * as updateHookModule from '@/hooks/calendar-groups/use-update-calendar-group-public-scheduling';

type UpdateHookMock = ReturnType<
  typeof updateHookModule.useUpdateCalendarGroupPublicScheduling
>;

function mockUpdateHook(
  updatePublicScheduling: ReturnType<typeof vi.fn>,
  isPending = false
) {
  vi.spyOn(
    updateHookModule,
    'useUpdateCalendarGroupPublicScheduling'
  ).mockReturnValue({
    updatePublicScheduling,
    updatePublicSchedulingMutation: { isPending },
  } as unknown as UpdateHookMock);
}

function mockAdmin(isAdmin: boolean) {
  vi.spyOn(permissionGateModule, 'useHasPermission').mockReturnValue(isAdmin);
}

function renderSettings(group: CalendarGroup) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<PublicSchedulingSettings group={group} />, { wrapper });
}

function makeGroup(overrides: Partial<CalendarGroup> = {}): CalendarGroup {
  return {
    id: 1,
    name: 'Surgery Team',
    description: 'Operating room coverage',
    slots: [],
    public_booking_slug: 'surgery-team',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

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
      makeGroup({ accepts_public_scheduling: false, duration: undefined })
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
      accepts_public_scheduling: true,
      duration: '00:30:00',
    });
    // Guard the tri-state contract directly: never an explicit null.
    const body = updatePublicScheduling.mock.calls[0][0];
    expect(Object.values(body)).not.toContain(null);
  });
});

describe('PublicSchedulingSettings — unrelated edit omits the unchanged field', () => {
  it('keeps duration omitted (not resent) when only the toggle changes', async () => {
    const user = userEvent.setup();
    mockAdmin(true);
    const updatePublicScheduling = vi.fn().mockResolvedValue({});
    mockUpdateHook(updatePublicScheduling);

    renderSettings(
      makeGroup({ accepts_public_scheduling: true, duration: '00:45:00' })
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
      makeGroup({ accepts_public_scheduling: false, duration: undefined })
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
      makeGroup({ accepts_public_scheduling: true, duration: '00:30:00' })
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

describe('PublicSchedulingSettings — grandfathered null-duration public group', () => {
  it('renders a warning instead of presenting the group as healthy', () => {
    mockAdmin(true);
    mockUpdateHook(vi.fn());

    renderSettings(
      makeGroup({ accepts_public_scheduling: true, duration: undefined })
    );

    expect(
      screen.getByTestId('grandfathered-duration-warning')
    ).toBeInTheDocument();
  });

  it('does not render the warning for a healthy public group with a duration', () => {
    mockAdmin(true);
    mockUpdateHook(vi.fn());

    renderSettings(
      makeGroup({ accepts_public_scheduling: true, duration: '00:30:00' })
    );

    expect(
      screen.queryByTestId('grandfathered-duration-warning')
    ).not.toBeInTheDocument();
  });

  it('does not render the warning for a private group with no duration', () => {
    mockAdmin(true);
    mockUpdateHook(vi.fn());

    renderSettings(
      makeGroup({ accepts_public_scheduling: false, duration: undefined })
    );

    expect(
      screen.queryByTestId('grandfathered-duration-warning')
    ).not.toBeInTheDocument();
  });
});
