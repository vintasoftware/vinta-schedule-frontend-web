import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Calendar } from 'lucide-react';

import { Icon } from './icon';
import { ICONS, ICON_NAMES } from './icon-registry';

/**
 * `icon` is a React component — not serializable, so it can never be set from
 * JSON. `name` is the string key that lets an icon come from data or config.
 */
describe('Icon name registry', () => {
  it('renders a glyph from a serializable name', () => {
    const { container } = render(<Icon name='calendar-plus' label='Add' />);
    expect(screen.getByRole('img', { name: 'Add' })).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('lets `icon` win over `name` (code path keeps precedence)', () => {
    const { container } = render(<Icon icon={Calendar} name='trash' />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders nothing rather than crashing when neither is given', () => {
    // A data-driven icon that is unset must be a hole, not a crash.
    const { container } = render(<Icon />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('every registry name resolves to a real component', () => {
    expect(ICON_NAMES.length).toBeGreaterThan(40);
    for (const n of ICON_NAMES) expect(ICONS[n]).toBeTruthy();
  });
});
