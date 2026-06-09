/**
 * AvailabilityTabs tests.
 *
 * Covers:
 * - Renders the tab indicated by ?tab= (deep-link / refresh persistence)
 * - Defaults to "My availability" when ?tab= is absent or invalid
 * - Switching tabs writes ?tab= via router.replace
 *
 * The four tab panels are mocked to simple markers so the test stays focused on
 * tab/URL wiring (the panels own their own data hooks, covered elsewhere).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replace = vi.fn();
let currentSearch = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/availability',
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock('./my-availability-view', () => ({
  MyAvailabilityView: () => <div>my-availability-panel</div>,
}));
vi.mock('./availability-editor', () => ({
  AvailabilityEditor: () => <div>available-times-panel</div>,
}));
vi.mock('./blocked-time-form', () => ({
  BlockedTimeForm: () => <div>blocked-times-panel</div>,
}));
vi.mock('./user-availability-view', () => ({
  UserAvailabilityView: () => <div>colleague-panel</div>,
}));

import { AvailabilityTabs } from './availability-tabs';

describe('AvailabilityTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearch = '';
  });

  it('defaults to My availability when ?tab= is absent', () => {
    render(<AvailabilityTabs />);
    expect(screen.getByText('my-availability-panel')).toBeInTheDocument();
  });

  it('renders the tab named by ?tab= (refresh persistence)', () => {
    currentSearch = 'tab=blocked';
    render(<AvailabilityTabs />);
    expect(screen.getByText('blocked-times-panel')).toBeInTheDocument();
  });

  it('falls back to My availability for an unknown ?tab= value', () => {
    currentSearch = 'tab=bogus';
    render(<AvailabilityTabs />);
    expect(screen.getByText('my-availability-panel')).toBeInTheDocument();
  });

  it('writes ?tab= via router.replace when a tab is selected', async () => {
    const user = userEvent.setup();
    render(<AvailabilityTabs />);

    await user.click(screen.getByRole('tab', { name: /available times/i }));

    expect(replace).toHaveBeenCalledWith('/availability?tab=available');
  });
});
