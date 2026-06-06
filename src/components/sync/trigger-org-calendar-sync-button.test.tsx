import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { TriggerOrgCalendarSyncButton } from './trigger-org-calendar-sync-button';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the hook
vi.mock('@/hooks/sync/use-trigger-org-calendar-sync');

import { useTriggerOrgCalendarSync } from '@/hooks/sync/use-trigger-org-calendar-sync';
import { toast } from 'sonner';

describe('TriggerOrgCalendarSyncButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the button', () => {
    vi.mocked(useTriggerOrgCalendarSync).mockReturnValue({
      triggerOrgCalendarSync: vi.fn().mockResolvedValue({}),
      triggerOrgCalendarSyncMutation: {
        isPending: false,
      },
    } as unknown as ReturnType<typeof useTriggerOrgCalendarSync>);

    render(<TriggerOrgCalendarSyncButton />);

    const button = screen.getByRole('button', { name: /sync all calendars/i });
    expect(button).toBeInTheDocument();
  });

  it('should call triggerOrgCalendarSync on click and show success toast', async () => {
    const mockTrigger = vi.fn().mockResolvedValue({});

    vi.mocked(useTriggerOrgCalendarSync).mockReturnValue({
      triggerOrgCalendarSync: mockTrigger,
      triggerOrgCalendarSyncMutation: {
        isPending: false,
      },
    } as unknown as ReturnType<typeof useTriggerOrgCalendarSync>);

    render(<TriggerOrgCalendarSyncButton />);

    const button = screen.getByRole('button', { name: /sync all calendars/i });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(mockTrigger).toHaveBeenCalledTimes(1);
    });

    expect(toast.success).toHaveBeenCalledWith('Calendar sync started');
  });

  it('should show error toast on failed sync', async () => {
    const mockTrigger = vi.fn().mockRejectedValue(new Error('Sync failed'));

    vi.mocked(useTriggerOrgCalendarSync).mockReturnValue({
      triggerOrgCalendarSync: mockTrigger,
      triggerOrgCalendarSyncMutation: {
        isPending: false,
      },
    } as unknown as ReturnType<typeof useTriggerOrgCalendarSync>);

    render(<TriggerOrgCalendarSyncButton />);

    const button = screen.getByRole('button', { name: /sync all calendars/i });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Sync failed');
    });
  });

  it('should debounce consecutive clicks', async () => {
    vi.useFakeTimers();

    const mockTrigger = vi.fn().mockResolvedValue({});

    vi.mocked(useTriggerOrgCalendarSync).mockReturnValue({
      triggerOrgCalendarSync: mockTrigger,
      triggerOrgCalendarSyncMutation: {
        isPending: false,
      },
    } as unknown as ReturnType<typeof useTriggerOrgCalendarSync>);

    render(<TriggerOrgCalendarSyncButton />);

    const button = screen.getByRole('button', { name: /sync all calendars/i });

    // First click
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockTrigger).toHaveBeenCalledTimes(1);

    // Second click (should be debounced)
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockTrigger).toHaveBeenCalledTimes(1);

    // Advance timers past debounce window
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // Third click (should work after debounce)
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockTrigger).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('should disable button while pending', () => {
    vi.mocked(useTriggerOrgCalendarSync).mockReturnValue({
      triggerOrgCalendarSync: vi.fn(),
      triggerOrgCalendarSyncMutation: {
        isPending: true,
      },
    } as unknown as ReturnType<typeof useTriggerOrgCalendarSync>);

    render(<TriggerOrgCalendarSyncButton />);

    const button = screen.getByRole('button', { name: /syncing/i });
    expect(button).toBeDisabled();
  });
});
