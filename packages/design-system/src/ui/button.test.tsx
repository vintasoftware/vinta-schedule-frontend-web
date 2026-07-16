import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Button } from './button';

describe('Button', () => {
  /**
   * Regression: `fullWidth` was declared as a cva variant but never destructured,
   * so it (a) never applied `w-full` and (b) fell through `...props` onto the DOM
   * as `fullwidth="true"`. It typechecked via VariantProps, so nothing caught it.
   */
  it('applies w-full when fullWidth is set', () => {
    render(<Button fullWidth>Submit</Button>);
    expect(screen.getByRole('button')).toHaveClass('w-full');
  });

  it('does not leak fullWidth onto the DOM', () => {
    render(<Button fullWidth>Submit</Button>);
    const el = screen.getByRole('button');
    expect(el.getAttribute('fullwidth')).toBeNull();
    expect(el.getAttribute('fullWidth')).toBeNull();
  });

  it('is not full width by default', () => {
    render(<Button>Submit</Button>);
    expect(screen.getByRole('button')).not.toHaveClass('w-full');
  });
});
