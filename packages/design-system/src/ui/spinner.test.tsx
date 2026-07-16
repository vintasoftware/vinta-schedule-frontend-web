import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Spinner } from './spinner';

/**
 * Spinner is Icon + Loader2 + spin. It is announced by default (role="status"),
 * which is the whole point of replacing the bare `<Loader2 className='animate-spin' />`.
 */
describe('Spinner', () => {
  it('spins and is announced as "Loading" by default', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status', { name: 'Loading' });
    expect(spinner).toHaveClass('animate-spin');
  });

  it('accepts a custom accessible name', () => {
    render(<Spinner label='Loading bookings' />);
    expect(
      screen.getByRole('status', { name: 'Loading bookings' })
    ).toBeInTheDocument();
  });

  it('is decorative when the label is emptied', () => {
    const { container } = render(<Spinner label='' />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });

  it('reuses the Icon size scale', () => {
    const { container } = render(<Spinner size='lg' />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('resolves a color token to a CSS var', () => {
    const { container } = render(<Spinner color='primary' />);
    expect(container.querySelector('svg')!.style.color).toBe('var(--primary)');
  });
});
