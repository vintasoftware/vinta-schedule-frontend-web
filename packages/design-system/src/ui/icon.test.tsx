import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Calendar } from 'lucide-react';

import { Icon } from './icon';

/**
 * The two contracts that matter: a token `size` becomes real pixels, and an
 * icon is hidden from assistive tech UNLESS it is given a name.
 */
describe('Icon', () => {
  it('is decorative (aria-hidden) with no label', () => {
    const { container } = render(<Icon icon={Calendar} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('exposes an img role with the accessible name when labelled', () => {
    render(<Icon icon={Calendar} label='Schedule' />);
    const icon = screen.getByRole('img', { name: 'Schedule' });
    expect(icon).not.toHaveAttribute('aria-hidden');
  });

  it('defaults to the 16px (size-4) scale', () => {
    const { container } = render(<Icon icon={Calendar} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
  });

  it.each([
    ['xs', '12'],
    ['sm', '16'],
    ['md', '20'],
    ['lg', '24'],
    ['xl', '32'],
  ] as const)('maps size %s to %spx', (size, px) => {
    const { container } = render(<Icon icon={Calendar} size={size} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', px);
    expect(svg).toHaveAttribute('height', px);
  });

  it('resolves a color token to a CSS var and never shrinks', () => {
    const { container } = render(
      <Icon icon={Calendar} color='muted-foreground' />
    );
    const svg = container.querySelector('svg')!;
    expect(svg.style.color).toBe('var(--muted-foreground)');
    expect(svg).toHaveClass('shrink-0');
  });

  it('spins only when asked', () => {
    const { container, rerender } = render(<Icon icon={Calendar} />);
    expect(container.querySelector('svg')).not.toHaveClass('animate-spin');
    rerender(<Icon icon={Calendar} spin />);
    expect(container.querySelector('svg')).toHaveClass('animate-spin');
  });

  it('forwards a ref to the svg element', () => {
    let node: SVGSVGElement | null = null;
    render(
      <Icon
        icon={Calendar}
        ref={(el) => {
          node = el;
        }}
      />
    );
    expect(node).toBeInstanceOf(SVGElement);
  });
});
