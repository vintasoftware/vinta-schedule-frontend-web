import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { Skeleton } from './skeleton';

const el = (c: HTMLElement) => c.firstElementChild as HTMLElement;

describe('Skeleton', () => {
  it('renders exactly as before with no props (backwards compatible)', () => {
    const { container } = render(<Skeleton />);
    const node = el(container);
    expect(node.className).toBe('bg-primary/10 animate-pulse rounded-md');
    // No sizing prop → no inline style attribute at all.
    expect(node.getAttribute('style')).toBeNull();
  });

  it('keeps className-driven usages untouched', () => {
    const { container } = render(<Skeleton className='h-10 w-full' />);
    const node = el(container);
    expect(node.className).toBe(
      'bg-primary/10 animate-pulse rounded-md h-10 w-full'
    );
    expect(node.getAttribute('style')).toBeNull();
  });

  it('resolves numeric width/height to px', () => {
    const { container } = render(<Skeleton width={120} height={16} />);
    expect(el(container).style.width).toBe('120px');
    expect(el(container).style.height).toBe('16px');
  });

  it('passes CSS length strings through', () => {
    const { container } = render(<Skeleton width='100%' height='2rem' />);
    expect(el(container).style.width).toBe('100%');
    expect(el(container).style.height).toBe('2rem');
  });

  it('maps radius onto the token scale', () => {
    const { container } = render(<Skeleton radius='lg' />);
    expect(el(container).style.borderRadius).toBe('var(--radius-lg)');
  });

  it("forces a full radius and 1:1 ratio for shape='circle'", () => {
    const { container } = render(<Skeleton shape='circle' width={48} />);
    const node = el(container);
    expect(node.style.borderRadius).toBe('9999px');
    expect(node.style.aspectRatio).toBe('1 / 1');
    expect(node.style.width).toBe('48px');
  });

  it("gives shape='text' a line-height default that an explicit height overrides", () => {
    const { container: a } = render(<Skeleton shape='text' />);
    expect(el(a).style.height).toBe('1em');

    const { container: b } = render(<Skeleton shape='text' height={8} />);
    expect(el(b).style.height).toBe('8px');
  });

  it('forwards arbitrary div attributes', () => {
    const { container } = render(
      <Skeleton data-testid='sk' aria-label='Loading' />
    );
    const node = el(container);
    expect(node.getAttribute('data-testid')).toBe('sk');
    expect(node.getAttribute('aria-label')).toBe('Loading');
  });
});
