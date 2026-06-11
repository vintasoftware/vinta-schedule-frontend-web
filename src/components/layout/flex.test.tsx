/**
 * Flex / Grid gap regression tests.
 *
 * Guards the bug where the `gap` shorthand was emitted alongside `undefined`
 * `rowGap`/`columnGap` longhands: React warns about mixing shorthand +
 * longhand and DROPS the shorthand on rerender, silently zeroing the gap
 * (which glued labels to switches/checkboxes/radios). The fix only assigns the
 * gap keys that are actually set.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Flex, HStack } from './flex';
import { Grid } from './grid';

describe('Flex gap', () => {
  it('emits the gap shorthand and NO rowGap/columnGap longhands when only gap is set', () => {
    const { container } = render(
      <HStack gap={2}>
        <span>a</span>
        <span>b</span>
      </HStack>
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.display).toBe('flex');
    expect(el.style.gap).toBe('0.5rem');
    // The longhands must be absent — their presence (even empty) is what made
    // React drop the shorthand.
    expect(el.style.rowGap).toBe('');
    expect(el.style.columnGap).toBe('');
  });

  it('omits gap entirely when not provided', () => {
    const { container } = render(
      <Flex>
        <span>a</span>
      </Flex>
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.gap).toBe('');
    expect(el.style.rowGap).toBe('');
    expect(el.style.columnGap).toBe('');
  });

  it('uses longhands (no shorthand) when only rowGap/columnGap are set', () => {
    const { container } = render(
      <Flex rowGap={2} columnGap={4}>
        <span>a</span>
      </Flex>
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.rowGap).toBe('0.5rem');
    expect(el.style.columnGap).toBe('1rem');
    expect(el.style.gap).toBe('');
  });
});

describe('Grid gap', () => {
  it('emits the gap shorthand and NO longhands when only gap is set', () => {
    const { container } = render(
      <Grid gap={3}>
        <span>a</span>
      </Grid>
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.display).toBe('grid');
    expect(el.style.gap).toBe('0.75rem');
    expect(el.style.rowGap).toBe('');
    expect(el.style.columnGap).toBe('');
  });
});
