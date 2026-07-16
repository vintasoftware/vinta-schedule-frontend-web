import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Sidebar, SidebarGroup, SidebarItem } from './sidebar';

describe('SidebarItem', () => {
  it('renders a button when there is no href', () => {
    render(<SidebarItem label='Calendar' iconName='calendar' />);
    expect(
      screen.getByRole('button', { name: /calendar/i })
    ).toBeInTheDocument();
  });

  it('renders a link when href is set', () => {
    render(<SidebarItem label='Bookings' href='/bookings' />);
    expect(screen.getByRole('link', { name: /bookings/i })).toHaveAttribute(
      'href',
      '/bookings'
    );
  });

  it('marks the active row with aria-current', () => {
    render(<SidebarItem label='Calendar' href='/calendar' active />);
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page');
  });

  it('renders the badge', () => {
    render(<SidebarItem label='Bookings' badge={8} />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  /**
   * Regression: `asChild` threw. The row renders three children (icon, label,
   * badge) and a bare <Slot> accepts only ONE, so it needs <Slottable> to mark
   * which child to clone. This is the pattern the app uses to get next/link
   * routing, so it must not silently break.
   */
  it('asChild renders the passed element as the row, with the row content inside', () => {
    render(
      <SidebarItem asChild label='Bookings' iconName='calendar-days' badge={8}>
        <a href='/bookings' data-testid='row' />
      </SidebarItem>
    );
    const row = screen.getByTestId('row');
    expect(row.tagName).toBe('A');
    expect(row).toHaveAttribute('href', '/bookings');
    // icon + label + badge are children of the passed element, not siblings
    expect(row).toHaveTextContent('Bookings');
    expect(row).toHaveTextContent('8');
    expect(row.querySelector('svg')).toBeInTheDocument();
    // exactly one anchor — the row must not be nested inside another
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('fires onClick when it is a button', async () => {
    const onClick = vi.fn();
    render(<SidebarItem label='Theme' onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('Sidebar', () => {
  it('renders brand, nav and footer', () => {
    render(
      <Sidebar brand={<span>Vinta</span>} footer={<span>Renata</span>}>
        <SidebarGroup label='Configure'>
          <SidebarItem label='Settings' iconName='settings' />
        </SidebarGroup>
      </Sidebar>
    );
    expect(screen.getByText('Vinta')).toBeInTheDocument();
    expect(screen.getByText('Renata')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByText('Configure')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /settings/i })
    ).toBeInTheDocument();
  });
});
