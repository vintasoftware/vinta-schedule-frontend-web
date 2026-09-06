import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppointmentTypeNotFound } from './appointment-type-not-found';

describe('AppointmentTypeNotFound', () => {
  it('renders one wording with a link back to the appointment types list', () => {
    render(<AppointmentTypeNotFound />);

    expect(screen.getByText('Appointment type not found')).toBeInTheDocument();
    expect(
      screen.getByText(
        "This appointment type isn't available. It may not exist, or you may not have access to it."
      )
    ).toBeInTheDocument();

    const link = screen.getByRole('link', {
      name: 'Back to appointment types',
    });
    expect(link).toHaveAttribute('href', '/appointment-types');
  });

  it('never mentions a specific reason (permission, organization, existence)', () => {
    const { container } = render(<AppointmentTypeNotFound />);
    const text = container.textContent ?? '';

    // The whole point of this component: no wording may hint at which of the
    // four indistinguishable 404 causes occurred.
    expect(text.toLowerCase()).not.toContain('permission');
    expect(text.toLowerCase()).not.toContain('organization');
    expect(text.toLowerCase()).not.toContain('unauthorized');
    expect(text.toLowerCase()).not.toContain('does not exist');
  });
});
