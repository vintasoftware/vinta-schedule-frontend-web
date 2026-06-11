/**
 * CreateGroupDialog tests.
 *
 * Covers:
 * - Building a group with 2 slots (names, required counts, calendar pools) →
 *   submit calls calendarGroupsCreate with the correct nested body.
 * - Zod validation:
 *     - No slots → form error shown (blocked by RHF — at least 1 slot shown)
 *     - Empty pool in a slot → form error shown; submit blocked.
 *     - required_count > pool size → form error shown; submit blocked.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// jsdom polyfills for Radix (Dialog/Checkbox)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
  if (!global.ResizeObserver) {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE any imports that use them
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarList: vi.fn(),
    calendarGroupsCreate: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { calendarList, calendarGroupsCreate } from '@/client/sdk.gen';
import { toast } from 'sonner';
import { CreateGroupDialog } from './create-group-dialog';
import type { Calendar, CalendarGroup } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function cal(id: number, name: string): Calendar {
  return {
    id,
    name,
    email: `c${id}@x.com`,
    external_id: `e${id}`,
    provider: 'internal',
    calendar_type: 'personal',
    capacity: null,
    is_active: true,
  } as Calendar;
}

const CAL_A = cal(1, 'Calendar A');
const CAL_B = cal(2, 'Calendar B');
const CAL_C = cal(3, 'Calendar C');

const MOCK_CALENDARS = [CAL_A, CAL_B, CAL_C];

// ---------------------------------------------------------------------------
// Mock response helpers
// ---------------------------------------------------------------------------

function mockCalendarList() {
  vi.mocked(calendarList).mockResolvedValue({
    data: { count: 3, results: MOCK_CALENDARS },
    response: new Response('{}', { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarList>>);
}

function mockGroupCreate(result?: Partial<CalendarGroup>) {
  const group: CalendarGroup = {
    id: 42,
    name: 'Test Group',
    description: '',
    slots: [],
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    ...result,
  };
  vi.mocked(calendarGroupsCreate).mockResolvedValue({
    data: group,
    response: new Response('{}', { status: 201 }),
  } as unknown as Awaited<ReturnType<typeof calendarGroupsCreate>>);
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderDialog(open = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onOpenChange = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const result = render(
    <CreateGroupDialog open={open} onOpenChange={onOpenChange} />,
    { wrapper }
  );
  return { ...result, onOpenChange, queryClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateGroupDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalendarList();
  });

  it('renders the dialog with form fields', async () => {
    renderDialog();

    expect(screen.getByText('New calendar group')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('e.g. Frontend Team')
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('What is this group used for?')
    ).toBeInTheDocument();
    // First slot should exist
    await screen.findByTestId('slot-editor-0');
    expect(screen.getByText('Slot 1')).toBeInTheDocument();
  });

  it('builds a group with 2 slots and correct calendar pools → calls calendarGroupsCreate with the right body', async () => {
    const user = userEvent.setup();
    mockGroupCreate();
    const { onOpenChange } = renderDialog();

    // Wait for calendars to load
    await screen.findByTestId('slot-editor-0');
    await screen.findByLabelText('Calendar A');

    // Fill group name
    await user.clear(screen.getByPlaceholderText('e.g. Frontend Team'));
    await user.type(
      screen.getByPlaceholderText('e.g. Frontend Team'),
      'My New Group'
    );

    // Fill slot 1 name
    const slot0 = screen.getByTestId('slot-editor-0');
    const slot0NameInput =
      within(slot0).getByPlaceholderText('e.g. Interviewer');
    await user.clear(slot0NameInput);
    await user.type(slot0NameInput, 'Interviewers');

    // Set required_count for slot 1 to 2
    const slot0CountInput = within(slot0).getByDisplayValue('1');
    await user.clear(slot0CountInput);
    await user.type(slot0CountInput, '2');

    // Check Calendar A and Calendar B for slot 1
    const slot0CalA = within(slot0).getByLabelText('Calendar A');
    const slot0CalB = within(slot0).getByLabelText('Calendar B');
    await user.click(slot0CalA);
    await user.click(slot0CalB);

    // Add a second slot
    const addSlotButton = screen.getByRole('button', { name: /add slot/i });
    await user.click(addSlotButton);

    // Wait for slot 2 to appear
    await screen.findByTestId('slot-editor-1');
    const slot1 = screen.getByTestId('slot-editor-1');

    // Fill slot 2 name
    const slot1NameInput =
      within(slot1).getByPlaceholderText('e.g. Interviewer');
    await user.clear(slot1NameInput);
    await user.type(slot1NameInput, 'Room');

    // required_count stays at 1 — check Calendar C only
    const slot1CalC = within(slot1).getByLabelText('Calendar C');
    await user.click(slot1CalC);

    // Submit
    const submitBtn = screen.getByTestId('create-group-submit');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(calendarGroupsCreate).toHaveBeenCalledOnce();
    });

    const callBody = vi.mocked(calendarGroupsCreate).mock.calls[0]?.[0]?.body;
    expect(callBody).toMatchObject({
      name: 'My New Group',
      slots: [
        {
          name: 'Interviewers',
          required_count: 2,
          calendar_ids: expect.arrayContaining([1, 2]),
        },
        {
          name: 'Room',
          required_count: 1,
          calendar_ids: [3],
        },
      ],
    });
    expect(callBody.slots[0].calendar_ids).toHaveLength(2);
    expect(callBody.slots[1].calendar_ids).toHaveLength(1);

    // Toast success should fire
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Calendar group created',
        expect.objectContaining({
          description: expect.stringContaining('My New Group'),
        })
      );
    });

    // Dialog closes
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('blocks submit when a slot has an empty calendar pool', async () => {
    const user = userEvent.setup();
    renderDialog();

    await screen.findByTestId('slot-editor-0');

    // Fill only group name + slot name, but leave pool empty
    await user.type(
      screen.getByPlaceholderText('e.g. Frontend Team'),
      'Empty Pool Group'
    );
    const slot0 = screen.getByTestId('slot-editor-0');
    await user.type(
      within(slot0).getByPlaceholderText('e.g. Interviewer'),
      'Slot One'
    );

    // Submit without selecting any calendar
    const submitBtn = screen.getByTestId('create-group-submit');
    await user.click(submitBtn);

    // Error message should appear for empty pool
    await waitFor(() => {
      expect(
        screen.getByText(/at least one calendar must be in the pool/i)
      ).toBeInTheDocument();
    });

    // calendarGroupsCreate should NOT have been called
    expect(calendarGroupsCreate).not.toHaveBeenCalled();
  });

  it('blocks submit when required_count exceeds pool size', async () => {
    const user = userEvent.setup();
    renderDialog();

    await screen.findByTestId('slot-editor-0');

    // Fill group name
    await user.type(
      screen.getByPlaceholderText('e.g. Frontend Team'),
      'Pool Size Group'
    );

    const slot0 = screen.getByTestId('slot-editor-0');

    // Fill slot name
    await user.type(
      within(slot0).getByPlaceholderText('e.g. Interviewer'),
      'Overloaded'
    );

    // Set required_count to 2 (more than the 1 calendar we'll add)
    const countInput = within(slot0).getByDisplayValue('1');
    await user.clear(countInput);
    await user.type(countInput, '2');

    // Only pick 1 calendar (pool size = 1, required = 2)
    const calA = within(slot0).getByLabelText('Calendar A');
    await user.click(calA);

    // Submit
    await user.click(screen.getByTestId('create-group-submit'));

    await waitFor(() => {
      expect(
        screen.getByText(/required count cannot exceed pool size/i)
      ).toBeInTheDocument();
    });

    expect(calendarGroupsCreate).not.toHaveBeenCalled();
  });

  it('adds a slot when "Add slot" is clicked', async () => {
    const user = userEvent.setup();
    renderDialog();

    await screen.findByTestId('slot-editor-0');
    expect(screen.queryByTestId('slot-editor-1')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add slot/i }));

    await screen.findByTestId('slot-editor-1');
    expect(screen.getByText('Slot 2')).toBeInTheDocument();
  });

  it('removes a slot when the remove button is clicked', async () => {
    const user = userEvent.setup();
    renderDialog();

    await screen.findByTestId('slot-editor-0');

    // Add a second slot first so "Remove" buttons appear
    await user.click(screen.getByRole('button', { name: /add slot/i }));
    await screen.findByTestId('slot-editor-1');

    // Remove the second slot
    const removeBtn = screen.getByRole('button', { name: /remove slot 2/i });
    await user.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('slot-editor-1')).not.toBeInTheDocument();
    });
  });

  it('shows a toast error if calendarGroupsCreate throws', async () => {
    const user = userEvent.setup();
    vi.mocked(calendarGroupsCreate).mockRejectedValueOnce(
      new Error('Server error')
    );
    renderDialog();

    await screen.findByTestId('slot-editor-0');

    // Fill minimum valid form
    await user.type(
      screen.getByPlaceholderText('e.g. Frontend Team'),
      'Error Group'
    );
    const slot0 = screen.getByTestId('slot-editor-0');
    await user.type(
      within(slot0).getByPlaceholderText('e.g. Interviewer'),
      'Slot One'
    );
    await user.click(within(slot0).getByLabelText('Calendar A'));

    await user.click(screen.getByTestId('create-group-submit'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to create calendar group',
        expect.objectContaining({ description: 'Server error' })
      );
    });
  });
});
