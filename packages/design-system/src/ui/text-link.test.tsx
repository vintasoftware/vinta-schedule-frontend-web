import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TextLink } from './text-link';

describe('TextLink', () => {
  it('renders an anchor with its href', () => {
    render(<TextLink href='/bookings'>View booking</TextLink>);
    const link = screen.getByRole('link', { name: 'View booking' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/bookings');
  });

  it('applies the underline variant classes', () => {
    render(
      <TextLink href='#' underline='always' variant='destructive'>
        Cancel
      </TextLink>
    );
    const link = screen.getByRole('link');
    expect(link).toHaveClass('underline');
    expect(link).toHaveClass('text-destructive');
  });

  describe('asChild', () => {
    it('renders the child element instead of its own anchor', () => {
      const { container } = render(
        <TextLink asChild underline='always'>
          <a href='/bookings' data-testid='router-link'>
            Go to bookings
          </a>
        </TextLink>
      );

      // Exactly one anchor — Slot merges into the child, it does not wrap it.
      expect(container.querySelectorAll('a')).toHaveLength(1);
      const link = screen.getByTestId('router-link');
      expect(link.tagName).toBe('A');
      expect(link.querySelector('a')).toBeNull();
      expect(link).toHaveAttribute('href', '/bookings');
    });

    it('merges its variant classes onto the child', () => {
      render(
        <TextLink asChild variant='muted' underline='always'>
          <a href='/help'>Help</a>
        </TextLink>
      );
      const link = screen.getByRole('link', { name: 'Help' });
      expect(link).toHaveClass('underline');
      expect(link).toHaveClass('text-muted-foreground');
    });

    it('keeps the child element type when it is not an anchor', () => {
      render(
        <TextLink asChild>
          <button type='button'>Resend code</button>
        </TextLink>
      );
      expect(screen.getByRole('button', { name: 'Resend code' })).toBeTruthy();
      expect(screen.queryByRole('link')).toBeNull();
    });
  });
});
