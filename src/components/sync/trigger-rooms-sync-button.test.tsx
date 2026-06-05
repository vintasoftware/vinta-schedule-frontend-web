import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { TriggerRoomsSyncButton } from './trigger-rooms-sync-button';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the hook
vi.mock('@/hooks/sync/use-trigger-rooms-sync');

import { useTriggerRoomsSync } from '@/hooks/sync/use-trigger-rooms-sync';
import { toast } from 'sonner';

describe('TriggerRoomsSyncButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the button', () => {
    vi.mocked(useTriggerRoomsSync).mockReturnValue({
      triggerRoomsSync: vi.fn().mockResolvedValue({}),
      triggerSyncMutation: {
        isPending: false,
      },
    } as unknown as ReturnType<typeof useTriggerRoomsSync>);

    render(<TriggerRoomsSyncButton />);

    const button = screen.getByRole('button', { name: /sync rooms/i });
    expect(button).toBeInTheDocument();
  });

  it('should call triggerRoomsSync on click', async () => {
    const mockTrigger = vi.fn().mockResolvedValue({});

    vi.mocked(useTriggerRoomsSync).mockReturnValue({
      triggerRoomsSync: mockTrigger,
      triggerSyncMutation: {
        isPending: false,
      },
    } as unknown as ReturnType<typeof useTriggerRoomsSync>);

    render(<TriggerRoomsSyncButton />);

    const button = screen.getByRole('button', { name: /sync rooms/i });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(mockTrigger).toHaveBeenCalledTimes(1);
    });
  });

  it('should show success toast on successful sync', async () => {
    const mockTrigger = vi.fn().mockResolvedValue({});

    vi.mocked(useTriggerRoomsSync).mockReturnValue({
      triggerRoomsSync: mockTrigger,
      triggerSyncMutation: {
        isPending: false,
      },
    } as unknown as ReturnType<typeof useTriggerRoomsSync>);

    render(<TriggerRoomsSyncButton />);

    const button = screen.getByRole('button', { name: /sync rooms/i });
    await act(async () => {
      fireEvent.click(button);
      await mockTrigger();
    });

    expect(toast.success).toHaveBeenCalledWith('Sync started');
  });

  it('should show error toast on failed sync', async () => {
    const mockTrigger = vi.fn().mockRejectedValue(new Error('Network error'));

    vi.mocked(useTriggerRoomsSync).mockReturnValue({
      triggerRoomsSync: mockTrigger,
      triggerSyncMutation: {
        isPending: false,
      },
    } as unknown as ReturnType<typeof useTriggerRoomsSync>);

    render(<TriggerRoomsSyncButton />);

    const button = screen.getByRole('button', { name: /sync rooms/i });
    await act(async () => {
      fireEvent.click(button);
      try {
        await mockTrigger();
      } catch {
        // Expected error
      }
    });

    expect(toast.error).toHaveBeenCalledWith('Network error');
  });

  it('should debounce consecutive clicks', async () => {
    vi.useFakeTimers();

    const mockTrigger = vi.fn().mockResolvedValue({});

    vi.mocked(useTriggerRoomsSync).mockReturnValue({
      triggerRoomsSync: mockTrigger,
      triggerSyncMutation: {
        isPending: false,
      },
    } as unknown as ReturnType<typeof useTriggerRoomsSync>);

    render(<TriggerRoomsSyncButton />);

    const button = screen.getByRole('button', { name: /sync rooms/i });

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
    vi.mocked(useTriggerRoomsSync).mockReturnValue({
      triggerRoomsSync: vi.fn(),
      triggerSyncMutation: {
        isPending: true,
      },
    } as unknown as ReturnType<typeof useTriggerRoomsSync>);

    render(<TriggerRoomsSyncButton />);

    const button = screen.getByRole('button', { name: /syncing/i });
    expect(button).toBeDisabled();
  });
});
