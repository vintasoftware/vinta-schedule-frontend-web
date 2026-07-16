/**
 * DocsSidebar — renders the static DOCS_NAV config and highlights the active
 * route.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DOCS_NAV } from '@/lib/docs/nav';
import { DocsSidebar } from './docs-sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/docs/getting-started',
}));

describe('DocsSidebar', () => {
  it('renders every DOCS_NAV section as a link', () => {
    render(<DocsSidebar />);

    for (const section of DOCS_NAV) {
      expect(
        screen.getByRole('link', { name: section.title })
      ).toBeInTheDocument();
    }
  });

  it('marks the section matching the current route as active', () => {
    render(<DocsSidebar />);

    expect(
      screen.getByRole('link', { name: 'Getting Started' })
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('link', { name: 'Schema Reference' })
    ).not.toHaveAttribute('aria-current');
  });
});
