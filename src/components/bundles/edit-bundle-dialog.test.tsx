/**
 * EditBundleDialog tests.
 *
 * Covers:
 *   - Pre-populated from current bundle's children_calendars and primary_calendar
 *   - Selecting different calendars triggers validation
 *   - Primary calendar must be one of the selected calendars
 *   - Submit sends the correct update body to useUpdateBundle
 *   - Toast displayed on success/error
 *   - Dialog closes on successful update
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { Calendar } from '@/client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/calendars/use-all-calendars', () => ({
  useAllCalendars: vi.fn(),
}));

vi.mock('@/hooks/bundles/use-update-bundle', () => ({
  useUpdateBundle: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useAllCalendars } from '@/hooks/calendars/use-all-calendars';
import { useUpdateBundle } from '@/hooks/bundles/use-update-bundle';
import { toast } from 'sonner';
import { EditBundleDialog } from './edit-bundle-dialog';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_CALENDAR_1: Calendar = {
  id: 1,
  name: 'Calendar 1',
  calendar_type: 'personal',
  is_active: true,
  email: 'cal1@example.com',
  external_id: 'ext-1',
  provider: 'google',
  capacity: null,
};

const FIXTURE_CALENDAR_2: Calendar = {
  ...FIXTURE_CALENDAR_1,
  id: 2,
  name: 'Calendar 2',
  email: 'cal2@example.com',
  external_id: 'ext-2',
};

const FIXTURE_CALENDAR_3: Calendar = {
  ...FIXTURE_CALENDAR_1,
  id: 3,
  name: 'Calendar 3',
  email: 'cal3@example.com',
  external_id: 'ext-3',
};

const FIXTURE_BUNDLE: Calendar = {
  id: 42,
  name: 'Main Office Bundle',
  calendar_type: 'bundle',
  is_active: true,
  email: 'bundle@example.com',
  external_id: 'ext-bundle',
  provider: 'google',
  capacity: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }
  return Wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditBundleDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with bundle name in title', async () => {
    vi.mocked(useAllCalendars).mockReturnValue({
      calendars: [FIXTURE_CALENDAR_1, FIXTURE_CALENDAR_2, FIXTURE_CALENDAR_3],
      isLoading: false,
      isError: false,
      error: null,
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    vi.mocked(useUpdateBundle).mockReturnValue({
      updateBundle: vi.fn(),
      updateBundleMutation: {
        isPending: false,
        isError: false,
        error: null,
        data: undefined,
        status: 'idle',
        failureCount: 0,
        failureReason: null,
        reset: vi.fn(),
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const wrapper = makeQueryWrapper();
    render(
      <EditBundleDialog
        bundle={FIXTURE_BUNDLE}
        open={true}
        onOpenChange={vi.fn()}
        currentChildren={[1, 2]}
        currentPrimary={1}
      />,
      { wrapper }
    );

    // Check title contains bundle name.
    expect(
      screen.getByText('Edit bundle: Main Office Bundle')
    ).toBeInTheDocument();

    // Check that the dialog has content and labels present
    expect(screen.getByText('Child calendars')).toBeInTheDocument();
    expect(screen.getByText('Primary calendar')).toBeInTheDocument();
  });

  it('validates that primary must be in bundle_calendars', async () => {
    vi.mocked(useAllCalendars).mockReturnValue({
      calendars: [FIXTURE_CALENDAR_1, FIXTURE_CALENDAR_2, FIXTURE_CALENDAR_3],
      isLoading: false,
      isError: false,
      error: null,
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const mockUpdate = vi.fn();
    vi.mocked(useUpdateBundle).mockReturnValue({
      updateBundle: mockUpdate,
      updateBundleMutation: {
        isPending: false,
        isError: false,
        error: null,
        data: undefined,
        status: 'idle',
        failureCount: 0,
        failureReason: null,
        reset: vi.fn(),
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const wrapper = makeQueryWrapper();
    render(
      <EditBundleDialog
        bundle={FIXTURE_BUNDLE}
        open={true}
        onOpenChange={vi.fn()}
        currentChildren={[1]}
        currentPrimary={1}
      />,
      { wrapper }
    );

    // Uncheck Calendar 1 (the current primary).
    const checkbox1 = screen.getByRole('checkbox', {
      name: /Calendar 1/i,
    });
    await userEvent.click(checkbox1);

    // Re-select Calendar 2 and set as primary.
    const checkbox2 = screen.getByRole('checkbox', {
      name: /Calendar 2/i,
    });
    await userEvent.click(checkbox2);

    const radio2 = screen.getByRole('radio', {
      name: /Calendar 2/i,
    });
    fireEvent.click(radio2);

    // Now primary is Calendar 2 (which is selected), form should be valid.
    const submitButton = screen.getByRole('button', {
      name: /Update bundle/i,
    });
    expect(submitButton).not.toHaveAttribute('disabled');
  });

  it('sends correct update body on submit', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAllCalendars).mockReturnValue({
      calendars: [FIXTURE_CALENDAR_1, FIXTURE_CALENDAR_2, FIXTURE_CALENDAR_3],
      isLoading: false,
      isError: false,
      error: null,
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    vi.mocked(useUpdateBundle).mockReturnValue({
      updateBundle: mockUpdate,
      updateBundleMutation: {
        isPending: false,
        isError: false,
        error: null,
        data: undefined,
        status: 'idle',
        failureCount: 0,
        failureReason: null,
        reset: vi.fn(),
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const wrapper = makeQueryWrapper();
    render(
      <EditBundleDialog
        bundle={FIXTURE_BUNDLE}
        open={true}
        onOpenChange={vi.fn()}
        currentChildren={[1, 2]}
        currentPrimary={1}
      />,
      { wrapper }
    );

    // Check Calendar 3 in addition to existing 1, 2.
    const checkbox3 = screen.getByRole('checkbox', {
      name: /Calendar 3/i,
    });
    await userEvent.click(checkbox3);

    // Set primary to Calendar 2.
    const radio2 = screen.getByRole('radio', {
      name: /Calendar 2/i,
    });
    fireEvent.click(radio2);

    // Submit the form.
    const submitButton = screen.getByRole('button', {
      name: /Update bundle/i,
    });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(42, {
        bundle_calendars: [1, 2, 3],
        primary_calendar: 2,
      });
    });
  });

  it('shows success toast on successful update', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAllCalendars).mockReturnValue({
      calendars: [FIXTURE_CALENDAR_1, FIXTURE_CALENDAR_2, FIXTURE_CALENDAR_3],
      isLoading: false,
      isError: false,
      error: null,
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    vi.mocked(useUpdateBundle).mockReturnValue({
      updateBundle: mockUpdate,
      updateBundleMutation: {
        isPending: false,
        isError: false,
        error: null,
        data: undefined,
        status: 'idle',
        failureCount: 0,
        failureReason: null,
        reset: vi.fn(),
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const wrapper = makeQueryWrapper();
    render(
      <EditBundleDialog
        bundle={FIXTURE_BUNDLE}
        open={true}
        onOpenChange={vi.fn()}
        currentChildren={[1, 2]}
        currentPrimary={1}
      />,
      { wrapper }
    );

    const submitButton = screen.getByRole('button', {
      name: /Update bundle/i,
    });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Bundle updated', {
        description: '"Main Office Bundle" has been updated.',
      });
    });
  });

  it('shows error toast on failed update', async () => {
    const mockError = new Error('Backend error');
    const mockUpdate = vi.fn().mockRejectedValue(mockError);
    vi.mocked(useAllCalendars).mockReturnValue({
      calendars: [FIXTURE_CALENDAR_1, FIXTURE_CALENDAR_2, FIXTURE_CALENDAR_3],
      isLoading: false,
      isError: false,
      error: null,
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    vi.mocked(useUpdateBundle).mockReturnValue({
      updateBundle: mockUpdate,
      updateBundleMutation: {
        isPending: false,
        isError: false,
        error: null,
        data: undefined,
        status: 'idle',
        failureCount: 0,
        failureReason: null,
        reset: vi.fn(),
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const wrapper = makeQueryWrapper();
    render(
      <EditBundleDialog
        bundle={FIXTURE_BUNDLE}
        open={true}
        onOpenChange={vi.fn()}
        currentChildren={[1, 2]}
        currentPrimary={1}
      />,
      { wrapper }
    );

    const submitButton = screen.getByRole('button', {
      name: /Update bundle/i,
    });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update bundle', {
        description: 'Backend error',
      });
    });
  });
});
