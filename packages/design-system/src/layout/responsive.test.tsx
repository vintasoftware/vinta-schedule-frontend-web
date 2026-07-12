import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { Box } from './box';
import { Flex } from './flex';
import { Grid } from './grid';

/**
 * The load-bearing invariant: a responsive prop must resolve to breakpoint
 * CLASSES and must NOT also emit an inline style for the same property. An
 * inline style beats a class, so if both were emitted the breakpoint value
 * would silently never apply.
 */
describe('responsive props', () => {
  it('emits breakpoint classes for a responsive value', () => {
    const { container } = render(<Grid columns={{ base: 1, md: 2, lg: 3 }} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('grid-cols-1');
    expect(el.className).toContain('md:grid-cols-2');
    expect(el.className).toContain('lg:grid-cols-3');
  });

  it('does NOT emit an inline style for a responsive value', () => {
    const { container } = render(<Grid columns={{ base: 1, md: 2 }} />);
    const el = container.firstChild as HTMLElement;
    // gridTemplateColumns must be absent — otherwise md:grid-cols-2 is dead.
    expect(el.style.gridTemplateColumns).toBe('');
  });

  it('still emits an inline style for a plain value', () => {
    const { container } = render(<Grid columns={3} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
    expect(el.className).not.toContain('grid-cols-3');
  });

  it('handles responsive flex direction and gap', () => {
    const { container } = render(
      <Flex
        direction={{ base: 'column', md: 'row' }}
        gap={{ base: 2, md: 4 }}
      />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('flex-col');
    expect(el.className).toContain('md:flex-row');
    expect(el.className).toContain('gap-2');
    expect(el.className).toContain('md:gap-4');
    expect(el.style.flexDirection).toBe('');
    expect(el.style.gap).toBe('');
  });

  it('handles responsive padding and display on Box (the hidden→flex idiom)', () => {
    const { container } = render(
      <Box display={{ base: 'hidden', md: 'flex' }} p={{ base: 4, md: 6 }} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('hidden');
    expect(el.className).toContain('md:flex');
    expect(el.className).toContain('p-4');
    expect(el.className).toContain('md:p-6');
    expect(el.style.padding).toBe('');
    expect(el.style.display).toBe('');
  });

  it('leaves plain box props on the inline-style path', () => {
    const { container } = render(<Box p={4} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.padding).toBe('1rem');
    expect(el.className).not.toContain('p-4');
  });

  it('never leaks a responsive object into the DOM as an attribute', () => {
    const { container } = render(<Box p={{ base: 4, md: 6 }} />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('p')).toBeNull();
    expect(el.outerHTML).not.toContain('object Object');
  });
});
