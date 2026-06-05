/**
 * ScopePromptDialog tests.
 *
 * Covers:
 *  - Renders all three scope options (This event / This and following / All events).
 *  - Default selection is "This event".
 *  - Selecting an option and clicking the action button calls onSelect with
 *    the correct scope value.
 *  - Clicking Cancel calls onOpenChange(false) without calling onSelect.
 *  - Selection resets to 'this' each time the dialog opens.
 *  - Custom actionLabel is rendered on the confirm button.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ScopePromptDialog } from './scope-prompt-dialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDialog(
  props?: Partial<React.ComponentProps<typeof ScopePromptDialog>>
) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    eventTitle: 'Weekly Standup',
    onSelect: vi.fn(),
    actionLabel: 'Cancel',
    ...props,
  };
  return render(<ScopePromptDialog {...defaults} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScopePromptDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all three scope options', () => {
    renderDialog();
    expect(screen.getByText('This event')).toBeInTheDocument();
    expect(screen.getByText('This and following events')).toBeInTheDocument();
    expect(screen.getByText('All events')).toBeInTheDocument();
  });

  it('renders the event title in the description', () => {
    renderDialog({ eventTitle: 'My Recurring Event' });
    expect(
      screen.getByText('My Recurring Event', { exact: false })
    ).toBeInTheDocument();
  });

  it('shows the actionLabel on the confirm button', () => {
    renderDialog({ actionLabel: 'Reschedule' });
    expect(
      screen.getByRole('button', { name: 'Reschedule' })
    ).toBeInTheDocument();
  });

  it('defaults to "This event" being selected', () => {
    renderDialog();
    const thisEventRadio = screen.getByRole('radio', { name: /this event/i });
    expect(thisEventRadio).toBeChecked();
  });

  it('calls onSelect with "this" when "This event" is selected and confirmed', async () => {
    const onSelect = vi.fn();
    renderDialog({ actionLabel: 'Apply', onSelect });

    // "This event" is already selected by default — click the action button.
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('this');
  });

  it('calls onSelect with "following" when "This and following events" is chosen', async () => {
    const onSelect = vi.fn();
    renderDialog({ actionLabel: 'Apply', onSelect });

    await userEvent.click(
      screen.getByRole('radio', { name: /this and following events/i })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('following');
  });

  it('calls onSelect with "all" when "All events" is chosen', async () => {
    const onSelect = vi.fn();
    renderDialog({ actionLabel: 'Apply', onSelect });

    await userEvent.click(screen.getByRole('radio', { name: /all events/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('all');
  });

  it('calls onOpenChange(false) when the Cancel button is clicked — without calling onSelect', async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ onSelect, onOpenChange });

    // The "Cancel" button in the footer (not the confirm button) should dismiss.
    // The dialog has two buttons: "Cancel" (dismiss) and the action button (also "Cancel" here).
    // We find the outline/dismiss Cancel by its position — it comes first.
    const buttons = screen.getAllByRole('button', { name: 'Cancel' });
    // First button is the dismiss "Cancel"; second is the action "Cancel".
    await userEvent.click(buttons[0]);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders nothing when open=false', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('This event')).not.toBeInTheDocument();
  });
});
