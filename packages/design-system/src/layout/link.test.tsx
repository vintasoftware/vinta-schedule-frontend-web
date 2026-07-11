import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrototypeModeProvider } from 'vinta-ui-composer-prototype-mode';

import { Link } from './link';

/**
 * The inert-vs-navigating contract (§8). An inert link renders an <a> with no
 * href, so it is not exposed as a link at all — asserting on the `link` role is
 * the sharpest way to pin that.
 */
describe('Link', () => {
  it('is inert with no provider (editor is the default)', () => {
    render(<Link linkTo='/bookings'>View booking</Link>);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('View booking')).not.toHaveAttribute('href');
  });

  it('is inert in editor mode even when a navigate is supplied', async () => {
    const navigate = vi.fn();
    render(
      <PrototypeModeProvider mode='editor' navigate={navigate}>
        <Link linkTo='/bookings'>View booking</Link>
      </PrototypeModeProvider>
    );
    await userEvent.click(screen.getByText('View booking'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates via the host callback in viewer mode', async () => {
    const navigate = vi.fn();
    render(
      <PrototypeModeProvider mode='viewer' navigate={navigate}>
        <Link linkTo='/bookings'>View booking</Link>
      </PrototypeModeProvider>
    );
    const link = screen.getByRole('link', { name: 'View booking' });
    expect(link).toHaveAttribute('href', '/bookings');

    await userEvent.click(link);
    expect(navigate).toHaveBeenCalledWith('/bookings');
  });

  it('is inert in viewer mode when the target is unreachable', async () => {
    const navigate = vi.fn();
    render(
      <PrototypeModeProvider
        mode='viewer'
        navigate={navigate}
        canNavigate={() => false}
      >
        <Link linkTo='/archived'>Archived</Link>
      </PrototypeModeProvider>
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Archived'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('prefetches the target on hover', async () => {
    const prefetch = vi.fn();
    render(
      <PrototypeModeProvider
        mode='viewer'
        navigate={vi.fn()}
        prefetch={prefetch}
      >
        <Link linkTo='/bookings'>View booking</Link>
      </PrototypeModeProvider>
    );
    await userEvent.hover(screen.getByRole('link'));
    expect(prefetch).toHaveBeenCalledWith('/bookings');
  });
});
