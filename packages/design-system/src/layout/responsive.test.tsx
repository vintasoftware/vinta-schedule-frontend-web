import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { Box } from './box';
import { Flex } from './flex';
import { Grid, GridItem } from './grid';

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

  // Regression: Flex/Grid unconditionally wrote `display: flex|grid` as an
  // inline style, which beat the `hidden md:flex` breakpoint classes — so a
  // responsive `display` silently did nothing on them (it only worked on Box).
  it('honours responsive display on Flex (inline display must not win)', () => {
    const { container } = render(
      <Flex display={{ base: 'hidden', md: 'flex' }} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('hidden');
    expect(el.className).toContain('md:flex');
    expect(el.style.display).toBe('');
  });

  it('honours responsive display on Grid (inline display must not win)', () => {
    const { container } = render(
      <Grid display={{ base: 'hidden', md: 'grid' }} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('hidden');
    expect(el.className).toContain('md:grid');
    expect(el.style.display).toBe('');
  });

  it('still sets inline display for a plain Flex', () => {
    const { container } = render(<Flex />);
    expect((container.firstChild as HTMLElement).style.display).toBe('flex');
  });

  // Container queries react to an ANCESTOR's width, not the viewport. The
  // breakpoint key IS the Tailwind variant prefix, so they share one code path.
  it('emits container-query classes for @-prefixed breakpoints', () => {
    const { container } = render(
      <Grid columns={{ base: 1, '@xl/content': 2, '@4xl/content': 3 }} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('grid-cols-1');
    expect(el.className).toContain('@xl/content:grid-cols-2');
    expect(el.className).toContain('@4xl/content:grid-cols-3');
    expect(el.style.gridTemplateColumns).toBe('');
  });

  it('mixes viewport and container breakpoints in one value', () => {
    const { container } = render(
      <Flex
        direction={{ base: 'column', md: 'row', '@3xl/topbar': 'column' }}
      />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('flex-col');
    expect(el.className).toContain('md:flex-row');
    expect(el.className).toContain('@3xl/topbar:flex-col');
    expect(el.style.flexDirection).toBe('');
  });

  it('honours a container-query display (inline display must not win)', () => {
    const { container } = render(
      <Flex display={{ base: 'hidden', '@3xl/topbar': 'flex' }} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('hidden');
    expect(el.className).toContain('@3xl/topbar:flex');
    expect(el.style.display).toBe('');
  });

  /* -------------------- flat per-breakpoint siblings ------------------------ */
  // Each responsive prop also takes flat `<prop>Md` scalar siblings, which fold
  // back into one Responsive value.

  it('folds Grid columns siblings into breakpoint classes', () => {
    const { container } = render(
      <Grid columns={1} columnsMd={2} columnsLg={3} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('grid-cols-1');
    expect(el.className).toContain('md:grid-cols-2');
    expect(el.className).toContain('lg:grid-cols-3');
    // A scalar base is promoted to the `base` breakpoint, so it must no longer
    // emit an inline style (which would beat the md:/lg: classes).
    expect(el.style.gridTemplateColumns).toBe('');
  });

  it('folds Flex direction/gap siblings', () => {
    const { container } = render(
      <Flex direction='column' directionMd='row' gap={2} gapMd={4} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('flex-col');
    expect(el.className).toContain('md:flex-row');
    expect(el.className).toContain('gap-2');
    expect(el.className).toContain('md:gap-4');
    expect(el.style.flexDirection).toBe('');
    expect(el.style.gap).toBe('');
  });

  it('folds Box padding/display siblings', () => {
    const { container } = render(
      <Box p={4} pMd={6} display='hidden' displayMd='flex' />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('p-4');
    expect(el.className).toContain('md:p-6');
    expect(el.className).toContain('hidden');
    expect(el.className).toContain('md:flex');
    expect(el.style.padding).toBe('');
  });

  it('folds GridItem span siblings', () => {
    const { container } = render(<GridItem span={1} spanLg={2} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('col-span-1');
    expect(el.className).toContain('lg:col-span-2');
    expect(el.style.gridColumn).toBe('');
  });

  it('never leaks a sibling prop onto the DOM', () => {
    const { container } = render(
      <Grid columnsMd={2} gapMd={4} pMd={6} displayMd='grid' />
    );
    const el = container.firstChild as HTMLElement;
    for (const attr of ['columnsmd', 'gapmd', 'pmd', 'displaymd']) {
      expect(el.getAttribute(attr)).toBeNull();
    }
    expect(el.outerHTML).not.toContain('object Object');
  });

  it('leaves the inline-style fast path alone when no sibling is set', () => {
    const { container } = render(<Box p={4} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.padding).toBe('1rem');
    expect(el.className).not.toContain('p-4');
  });

  /* ---------------------- container-query siblings -------------------------- */

  it('folds Cq siblings against the chosen container', () => {
    const { container: c } = render(
      <Grid container='content' columns={1} columnsCqXl={2} columnsCq4xl={3} />
    );
    const el = c.firstChild as HTMLElement;
    expect(el.className).toContain('grid-cols-1');
    expect(el.className).toContain('@xl/content:grid-cols-2');
    expect(el.className).toContain('@4xl/content:grid-cols-3');
    expect(el.style.gridTemplateColumns).toBe('');
  });

  it('IGNORES Cq siblings when no container is chosen', () => {
    // A container-query class is inert unless an ancestor is marked
    // @container/<name>. Emitting one anyway would look like it works and
    // silently never match — so the siblings are dropped instead.
    const { container: c } = render(<Grid columns={2} columnsCqXl={4} />);
    const el = c.firstChild as HTMLElement;
    expect(el.className).not.toContain('@xl/');
    // base stays on the inline-style fast path
    expect(el.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('asContainer marks the element as a named container', () => {
    const { container: c } = render(<Box asContainer='content' />);
    const el = c.firstChild as HTMLElement;
    expect(el.className).toContain('@container/content');
    expect(el.getAttribute('ascontainer')).toBeNull();
  });

  it('supports the full loop: declare a container, then respond to it', () => {
    const { container: c } = render(
      <Box asContainer='content'>
        <Flex container='content' direction='column' directionCq3xl='row' />
      </Box>
    );
    const outer = c.firstChild as HTMLElement;
    const inner = outer.firstChild as HTMLElement;
    expect(outer.className).toContain('@container/content');
    expect(inner.className).toContain('flex-col');
    expect(inner.className).toContain('@3xl/content:flex-row');
    expect(inner.style.flexDirection).toBe('');
  });

  it('folds Box padding + GridItem span Cq siblings', () => {
    const { container: c } = render(<Box container='topbar' p={2} pCqXl={8} />);
    expect((c.firstChild as HTMLElement).className).toContain('@xl/topbar:p-8');

    const { container: c2 } = render(
      <GridItem container='content' span={1} spanCq4xl={2} />
    );
    expect((c2.firstChild as HTMLElement).className).toContain(
      '@4xl/content:col-span-2'
    );
  });

  it('never leaks a Cq sibling or container prop onto the DOM', () => {
    const { container: c } = render(
      <Grid container='content' asContainer='app' columnsCqXl={2} pCqMd={4} />
    );
    const el = c.firstChild as HTMLElement;
    for (const attr of ['container', 'ascontainer', 'columnscqxl', 'pcqmd']) {
      expect(el.getAttribute(attr)).toBeNull();
    }
    expect(el.outerHTML).not.toContain('object Object');
  });

  it('never leaks a responsive object into the DOM as an attribute', () => {
    const { container } = render(<Box p={{ base: 4, md: 6 }} />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('p')).toBeNull();
    expect(el.outerHTML).not.toContain('object Object');
  });
});
