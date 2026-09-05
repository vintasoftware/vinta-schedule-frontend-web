/**
 * CreateGroupDialog tests.
 *
 * Covers:
 * - Building a group with 2 slots (names, required counts, individually picked
 *   calendars) → submit calls calendarGroupsCreate with the correct nested body.
 * - Attaching a calendar pool to a slot: the pool's calendars count toward the
 *   slot's roster, and `pool_ids` is sent alongside `calendar_ids`.
 * - Zod validation, all of it against the EFFECTIVE roster (individual picks ∪
 *   attached pools' calendars), not the individual picks alone:
 *     - No slots → form error shown (blocked by RHF — at least 1 slot shown)
 *     - Empty roster in a slot → form error shown; submit blocked.
 *     - required_count > roster size → form error shown; submit blocked.
 *     - required_count satisfied purely by a pool → submit allowed.
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
    calendarPoolsList: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import {
  calendarList,
  calendarGroupsCreate,
  calendarPoolsList,
} from '@/client/sdk.gen';
import { toast } from 'sonner';
import { CreateGroupDialog } from './create-group-dialog';
import type { Calendar, CalendarGroup, CalendarPool } from '@/client';

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

/** "Nurses" — a pool holding Calendar A and Calendar B. */
const POOL_NURSES: CalendarPool = {
  id: 7,
  name: 'Nurses',
  description: '',
  calendars: [CAL_A, CAL_B],
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Mock response helpers
// ---------------------------------------------------------------------------

function mockCalendarList() {
  vi.mocked(calendarList).mockResolvedValue({
    data: { count: 3, results: MOCK_CALENDARS },
    response: new Response('{}', { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarList>>);
}

function mockPoolList(pools: CalendarPool[] = [POOL_NURSES]) {
  vi.mocked(calendarPoolsList).mockResolvedValue({
    data: { count: pools.length, results: pools },
    response: new Response('{}', { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarPoolsList>>);
}

function mockGroupCreate(result?: Partial<CalendarGroup>) {
  const group: CalendarGroup = {
    id: 42,
    name: 'Test Group',
    description: '',
    slots: [],
    public_booking_slug: 'test-group',
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

/**
 * Pick options in one of a slot's multi-select comboboxes: open the trigger,
 * click each option (options render in a portal, so query via `screen`), then
 * close the popover with Escape so the rest of the form is interactable.
 */
async function pickInCombobox(
  user: ReturnType<typeof userEvent.setup>,
  slotEl: HTMLElement,
  comboboxName: RegExp,
  optionNames: (string | RegExp)[]
) {
  const trigger = within(slotEl).getByRole('combobox', { name: comboboxName });
  await user.click(trigger);
  for (const name of optionNames) {
    await user.click(await screen.findByRole('option', { name }));
  }
  await user.keyboard('{Escape}');
}

/** Pick calendars in a slot's "Individual calendars" combobox. */
async function pickIndividualCalendars(
  user: ReturnType<typeof userEvent.setup>,
  slotEl: HTMLElement,
  names: string[]
) {
  await pickInCombobox(user, slotEl, /individual calendars/i, names);
}

/** Attach pools in a slot's "Calendar pools" combobox. */
async function pickPools(
  user: ReturnType<typeof userEvent.setup>,
  slotEl: HTMLElement,
  names: RegExp[]
) {
  await pickInCombobox(user, slotEl, /calendar pools/i, names);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateGroupDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalendarList();
    mockPoolList();
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

  it('builds a group with 2 slots and correct rosters → calls calendarGroupsCreate with the right body', async () => {
    const user = userEvent.setup();
    mockGroupCreate();
    const { onOpenChange } = renderDialog();

    await screen.findByTestId('slot-editor-0');

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

    // Pick Calendar A and Calendar B for slot 1's pool
    await pickIndividualCalendars(user, slot0, ['Calendar A', 'Calendar B']);

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

    // required_count stays at 1 — pick Calendar C only
    await pickIndividualCalendars(user, slot1, ['Calendar C']);

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

  it('blocks submit when a slot has an empty roster', async () => {
    const user = userEvent.setup();
    renderDialog();

    await screen.findByTestId('slot-editor-0');

    // Fill only group name + slot name, but leave the roster empty
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

    // Error message should appear for the empty roster
    await waitFor(() => {
      expect(
        screen.getByText(/add at least one calendar or pool to this slot/i)
      ).toBeInTheDocument();
    });

    // calendarGroupsCreate should NOT have been called
    expect(calendarGroupsCreate).not.toHaveBeenCalled();
  });

  it('blocks submit when required_count exceeds the roster size', async () => {
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
    await pickIndividualCalendars(user, slot0, ['Calendar A']);

    // Submit
    await user.click(screen.getByTestId('create-group-submit'));

    await waitFor(() => {
      expect(
        screen.getByText(/required count cannot exceed the roster size \(1\)/i)
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

  it('sends pool_ids alongside calendar_ids when a pool is attached', async () => {
    const user = userEvent.setup();
    mockGroupCreate();
    renderDialog();

    await screen.findByTestId('slot-editor-0');

    await user.type(
      screen.getByPlaceholderText('e.g. Frontend Team'),
      'Clinic'
    );
    const slot0 = screen.getByTestId('slot-editor-0');
    await user.type(
      within(slot0).getByPlaceholderText('e.g. Interviewer'),
      'Nurse'
    );

    // The pool contributes Calendar A + B; Calendar C is picked individually.
    await pickPools(user, slot0, [/^Nurses \(2\)$/]);
    await pickIndividualCalendars(user, slot0, ['Calendar C']);

    await user.click(screen.getByTestId('create-group-submit'));

    await waitFor(() => {
      expect(calendarGroupsCreate).toHaveBeenCalledOnce();
    });

    const callBody = vi.mocked(calendarGroupsCreate).mock.calls[0]?.[0]?.body;
    expect(callBody.slots[0]).toMatchObject({
      name: 'Nurse',
      calendar_ids: [3],
      pool_ids: [7],
    });
  });

  it('counts an attached pool toward the roster, so required_count 2 passes with no individual calendars', async () => {
    const user = userEvent.setup();
    mockGroupCreate();
    renderDialog();

    await screen.findByTestId('slot-editor-0');

    await user.type(
      screen.getByPlaceholderText('e.g. Frontend Team'),
      'Two Nurses'
    );
    const slot0 = screen.getByTestId('slot-editor-0');
    await user.type(
      within(slot0).getByPlaceholderText('e.g. Interviewer'),
      'Nurses'
    );

    const countInput = within(slot0).getByDisplayValue('1');
    await user.clear(countInput);
    await user.type(countInput, '2');

    // No individual calendars at all — the pool's two calendars are the roster.
    await pickPools(user, slot0, [/^Nurses \(2\)$/]);

    await user.click(screen.getByTestId('create-group-submit'));

    await waitFor(() => {
      expect(calendarGroupsCreate).toHaveBeenCalledOnce();
    });

    const callBody = vi.mocked(calendarGroupsCreate).mock.calls[0]?.[0]?.body;
    expect(callBody.slots[0]).toMatchObject({
      required_count: 2,
      calendar_ids: [],
      pool_ids: [7],
    });
  });

  it('deduplicates a calendar present both individually and via a pool when sizing the roster', async () => {
    const user = userEvent.setup();
    renderDialog();

    await screen.findByTestId('slot-editor-0');

    await user.type(
      screen.getByPlaceholderText('e.g. Frontend Team'),
      'Overlap'
    );
    const slot0 = screen.getByTestId('slot-editor-0');
    await user.type(
      within(slot0).getByPlaceholderText('e.g. Interviewer'),
      'Nurses'
    );

    // Pool = {A, B}; picking A individually must NOT make the roster look like 3.
    await pickPools(user, slot0, [/^Nurses \(2\)$/]);
    await pickIndividualCalendars(user, slot0, ['Calendar A']);

    const countInput = within(slot0).getByDisplayValue('1');
    await user.clear(countInput);
    await user.type(countInput, '3');

    await user.click(screen.getByTestId('create-group-submit'));

    await waitFor(() => {
      expect(
        screen.getByText(/required count cannot exceed the roster size \(2\)/i)
      ).toBeInTheDocument();
    });

    expect(calendarGroupsCreate).not.toHaveBeenCalled();
  });

  it('sets accepts_public_scheduling and duration at creation time', async () => {
    // Regression: these two were unsettable at creation, so a new group could
    // not be made publicly bookable without a second trip to the detail page.
    const user = userEvent.setup();
    mockGroupCreate();
    renderDialog();

    await screen.findByTestId('slot-editor-0');

    await user.type(
      screen.getByPlaceholderText('e.g. Frontend Team'),
      'Clinic'
    );
    const slot0 = screen.getByTestId('slot-editor-0');
    await user.type(
      within(slot0).getByPlaceholderText('e.g. Interviewer'),
      'Nurse'
    );
    await pickIndividualCalendars(user, slot0, ['Calendar A']);

    await user.click(
      screen.getByRole('switch', { name: 'Accept public bookings' })
    );
    const durationInput = screen.getByRole('spinbutton', {
      name: 'Appointment length in minutes',
    });
    await user.clear(durationInput);
    await user.type(durationInput, '30');

    await user.click(screen.getByTestId('create-group-submit'));

    await waitFor(() => {
      expect(calendarGroupsCreate).toHaveBeenCalledOnce();
    });
    expect(
      vi.mocked(calendarGroupsCreate).mock.calls[0]?.[0]?.body
    ).toMatchObject({
      name: 'Clinic',
      accepts_public_scheduling: true,
      duration: '00:30:00',
    });
  });

  it('blocks accepting public bookings with no appointment length', async () => {
    // The server rejects a public group with no duration; catch it here so the
    // request is never sent.
    const user = userEvent.setup();
    renderDialog();

    await screen.findByTestId('slot-editor-0');

    await user.type(
      screen.getByPlaceholderText('e.g. Frontend Team'),
      'Clinic'
    );
    const slot0 = screen.getByTestId('slot-editor-0');
    await user.type(
      within(slot0).getByPlaceholderText('e.g. Interviewer'),
      'Nurse'
    );
    await pickIndividualCalendars(user, slot0, ['Calendar A']);

    await user.click(
      screen.getByRole('switch', { name: 'Accept public bookings' })
    );
    await user.click(screen.getByTestId('create-group-submit'));

    expect(
      await screen.findByText(/set an appointment length before accepting/i)
    ).toBeInTheDocument();
    expect(calendarGroupsCreate).not.toHaveBeenCalled();
  });

  it('omits duration entirely when no length was typed', async () => {
    // `duration` refuses an explicit null, and 0 is how "unset" reads back —
    // so a private group with no length sends no key at all.
    const user = userEvent.setup();
    mockGroupCreate();
    renderDialog();

    await screen.findByTestId('slot-editor-0');

    await user.type(
      screen.getByPlaceholderText('e.g. Frontend Team'),
      'Clinic'
    );
    const slot0 = screen.getByTestId('slot-editor-0');
    await user.type(
      within(slot0).getByPlaceholderText('e.g. Interviewer'),
      'Nurse'
    );
    await pickIndividualCalendars(user, slot0, ['Calendar A']);

    await user.click(screen.getByTestId('create-group-submit'));

    await waitFor(() => {
      expect(calendarGroupsCreate).toHaveBeenCalledOnce();
    });
    const body = vi.mocked(calendarGroupsCreate).mock.calls[0]?.[0]?.body as
      | Record<string, unknown>
      | undefined;
    expect(body && 'duration' in body).toBe(false);
    expect(body?.accepts_public_scheduling).toBe(false);
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
    await pickIndividualCalendars(user, slot0, ['Calendar A']);

    await user.click(screen.getByTestId('create-group-submit'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to create calendar group',
        expect.objectContaining({ description: 'Server error' })
      );
    });
  });
});
