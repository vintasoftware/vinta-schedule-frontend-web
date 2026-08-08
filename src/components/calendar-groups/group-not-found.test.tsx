import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupNotFound } from './group-not-found';

describe('GroupNotFound', () => {
  it('renders one wording with a link back to the groups list', () => {
    render(<GroupNotFound />);

    expect(screen.getByText('Group not found')).toBeInTheDocument();
    expect(
      screen.getByText(
        "This calendar group isn't available. It may not exist, or you may not have access to it."
      )
    ).toBeInTheDocument();

    const link = screen.getByRole('link', {
      name: 'Back to calendar groups',
    });
    expect(link).toHaveAttribute('href', '/groups');
  });

  it('never mentions a specific reason (permission, organization, existence)', () => {
    const { container } = render(<GroupNotFound />);
    const text = container.textContent ?? '';

    // The whole point of this component: no wording may hint at which of the
    // four indistinguishable 404 causes occurred.
    expect(text.toLowerCase()).not.toContain('permission');
    expect(text.toLowerCase()).not.toContain('organization');
    expect(text.toLowerCase()).not.toContain('unauthorized');
    expect(text.toLowerCase()).not.toContain('does not exist');
  });
});
