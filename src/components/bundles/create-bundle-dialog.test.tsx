import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CreateBundleDialog } from './create-bundle-dialog';

// ---------------------------------------------------------------------------
// jsdom polyfills for Radix (Dialog/Popover) + cmdk
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
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/bundles',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarBundleCreate: vi.fn(),
    calendarList: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// After mocks, import modules under test.
import { calendarBundleCreate, calendarList } from '@/client/sdk.gen';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderDialog(
  open = true,
  onOpenChange = vi.fn()
): ReturnType<typeof render> & { onOpenChange: ReturnType<typeof vi.fn> } {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const result = render(
    <CreateBundleDialog open={open} onOpenChange={onOpenChange} />,
    { wrapper }
  );
  return Object.assign(result, { onOpenChange });
}

/**
 * Select calendars in the "Child calendars" multi-select combobox: open the
 * trigger, click each option (options render in a portal, so query via
 * `screen`), then close the popover with Escape so the rest of the form is
 * interactable.
 */
async function selectChildCalendars(
  user: ReturnType<typeof userEvent.setup>,
  names: string[]
) {
  const trigger = await screen.findByRole('combobox', {
    name: /child calendars/i,
  });
  await waitFor(() => expect(trigger).toBeEnabled());
  await user.click(trigger);
  for (const name of names) {
    await user.click(await screen.findByRole('option', { name }));
  }
  await user.keyboard('{Escape}');
}

const mockCalendars = [
  {
    id: 1,
    name: 'Alice',
    calendar_type: 'personal' as const,
    email: 'alice@example.com',
    external_id: 'ext-1',
    provider: 'google' as const,
    capacity: null,
    is_active: true,
  },
  {
    id: 2,
    name: 'Bob',
    calendar_type: 'personal' as const,
    email: 'bob@example.com',
    external_id: 'ext-2',
    provider: 'google' as const,
    capacity: null,
    is_active: true,
  },
  {
    id: 3,
    name: 'Conference Room',
    calendar_type: 'resource' as const,
    email: 'conf@example.com',
    external_id: 'ext-3',
    provider: 'google' as const,
    capacity: 10,
    is_active: true,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateBundleDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock calendarList to return mock calendars.
    vi.mocked(calendarList).mockResolvedValue({
      data: { results: mockCalendars, count: 3 },
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof calendarList>>);

    // Mock calendarBundleCreate to resolve successfully.
    vi.mocked(calendarBundleCreate).mockResolvedValue({
      data: {
        id: 100,
        name: 'Test Bundle',
        calendar_type: 'bundle',
        email: 'bundle@example.com',
        external_id: 'ext-bundle',
        provider: 'internal' as const,
        capacity: null,
        is_active: true,
      },
      response: new Response('{}', { status: 201 }),
    } as unknown as Awaited<ReturnType<typeof calendarBundleCreate>>);
  });

  it('renders when open', () => {
    renderDialog();
    expect(screen.getByText('New bundle')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Main office/i)).toBeInTheDocument();
  });

  it('shows all calendars as options for child selection', async () => {
    const user = userEvent.setup();
    renderDialog();

    const trigger = await screen.findByRole('combobox', {
      name: /child calendars/i,
    });
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);

    expect(
      await screen.findByRole('option', { name: 'Alice' })
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bob' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Conference Room' })
    ).toBeInTheDocument();
  });

  it('validates that bundle name is required', async () => {
    const user = userEvent.setup();
    renderDialog();

    const submitButton = screen.getByTestId('create-bundle-submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Bundle name is required')).toBeInTheDocument();
    });
  });

  it('validates that at least one calendar must be selected', async () => {
    const user = userEvent.setup();
    renderDialog();

    const nameInput = screen.getByPlaceholderText(/Main office/i);
    await user.type(nameInput, 'Test Bundle');

    const submitButton = screen.getByTestId('create-bundle-submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText('At least one calendar must be selected')
      ).toBeInTheDocument();
    });
  });

  it('validates that a primary calendar must be selected', async () => {
    const user = userEvent.setup();
    renderDialog();

    const nameInput = screen.getByPlaceholderText(/Main office/i);
    await user.type(nameInput, 'Test Bundle');

    await selectChildCalendars(user, ['Alice']);

    const submitButton = screen.getByTestId('create-bundle-submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText('A primary calendar must be selected')
      ).toBeInTheDocument();
    });
  });

  it('allows creating a bundle with one calendar', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog(true, onOpenChange);

    const nameInput = screen.getByPlaceholderText(/Main office/i);
    await user.type(nameInput, 'Single Bundle');

    await selectChildCalendars(user, ['Alice']);

    const aliceRadio = screen.getByRole('radio', { name: 'Alice' });
    await user.click(aliceRadio);

    const submitButton = screen.getByTestId('create-bundle-submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(calendarBundleCreate).toHaveBeenCalled();
      const call = vi.mocked(calendarBundleCreate).mock.calls[0];
      expect(call[0].body.name).toBe('Single Bundle');
      expect(call[0].body.bundle_calendars).toContain(1);
      expect(call[0].body.primary_calendar).toBe(1);
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('allows creating a bundle with multiple calendars', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog(true, onOpenChange);

    const nameInput = screen.getByPlaceholderText(/Main office/i);
    await user.type(nameInput, 'Multi Bundle');

    await selectChildCalendars(user, ['Alice', 'Bob']);

    const bobRadio = screen.getByRole('radio', { name: 'Bob' });
    await user.click(bobRadio);

    const submitButton = screen.getByTestId('create-bundle-submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(calendarBundleCreate).toHaveBeenCalled();
      const call = vi.mocked(calendarBundleCreate).mock.calls[0];
      expect(call[0].body.name).toBe('Multi Bundle');
      expect(call[0].body.primary_calendar).toBe(2);
      expect(call[0].body.bundle_calendars).toContain(1);
      expect(call[0].body.bundle_calendars).toContain(2);
    });
  });

  it('shows error toast on creation failure', async () => {
    const user = userEvent.setup();
    const error = new Error('API error');
    vi.mocked(calendarBundleCreate).mockRejectedValueOnce(error);

    renderDialog();

    const nameInput = screen.getByPlaceholderText(/Main office/i);
    await user.type(nameInput, 'Test Bundle');

    await selectChildCalendars(user, ['Alice']);

    const aliceRadio = screen.getByRole('radio', { name: 'Alice' });
    await user.click(aliceRadio);

    const submitButton = screen.getByTestId('create-bundle-submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('closes the dialog on successful creation', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog(true, onOpenChange);

    const nameInput = screen.getByPlaceholderText(/Main office/i);
    await user.type(nameInput, 'Test Bundle');

    await selectChildCalendars(user, ['Alice']);

    const aliceRadio = screen.getByRole('radio', { name: 'Alice' });
    await user.click(aliceRadio);

    const submitButton = screen.getByTestId('create-bundle-submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
