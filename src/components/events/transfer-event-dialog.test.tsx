import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TransferEventDialog } from './transfer-event-dialog';

// Mock dependencies
vi.mock('@/hooks/calendars/use-all-calendars', () => ({
  useAllCalendars: vi.fn(() => ({
    calendars: [
      { id: 1, name: 'Calendar A', calendar_type: 'personal' },
      { id: 2, name: 'Calendar B', calendar_type: 'personal' },
      { id: 3, name: 'Calendar C', calendar_type: 'resource' },
    ],
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

vi.mock('@/hooks/events/use-transfer-event', () => ({
  useTransferEvent: vi.fn(() => ({
    transferEvent: vi.fn(async (eventId: number, destId: number) => {
      return { id: eventId, calendar_id: destId };
    }),
    transferEventMutation: {
      isPending: false,
      mutateAsync: vi.fn(),
    },
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TransferEventDialog', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    eventId: 123,
    eventTitle: 'Test Event',
    onTransferred: vi.fn(),
  };

  const renderDialog = (props = defaultProps) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TransferEventDialog {...props} />
      </QueryClientProvider>
    );
  };

  it('should render the dialog when open is true', () => {
    renderDialog();

    expect(
      screen.getByRole('heading', { name: /transfer event/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Test Event/i)).toBeInTheDocument();
  });

  it('should render destination calendar select', () => {
    renderDialog();

    expect(screen.getByLabelText(/destination calendar/i)).toBeInTheDocument();
  });

  it('should disable submit button when no calendar is selected', () => {
    renderDialog();

    const transferButton = screen.getByRole('button', { name: /transfer/i });
    expect(transferButton).toBeDisabled();
  });

  it('should render cancel and transfer buttons', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /transfer/i })
    ).toBeInTheDocument();
  });

  it('should close dialog when cancel is clicked', () => {
    const onOpenChange = vi.fn();
    renderDialog({
      ...defaultProps,
      onOpenChange,
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    cancelButton.click();

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should display event title in description', () => {
    const eventTitle = 'My Important Meeting';
    renderDialog({
      ...defaultProps,
      eventTitle,
    });

    expect(screen.getByText(new RegExp(eventTitle))).toBeInTheDocument();
  });

  it('should disable buttons while loading calendars', () => {
    // Re-mock with loading state
    vi.resetAllMocks();
    vi.mock('@/hooks/calendars/use-all-calendars', () => ({
      useAllCalendars: vi.fn(() => ({
        calendars: [],
        isLoading: true,
        isError: false,
        error: null,
      })),
    }));

    renderDialog();

    const transferButton = screen.getByRole('button', { name: /transfer/i });
    expect(transferButton).toBeDisabled();
  });
});
