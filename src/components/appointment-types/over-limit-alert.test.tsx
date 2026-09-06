/**
 * OverLimitAlert tests.
 *
 * Covers:
 * - resource, current_usage, and limit from the typed body all render on
 *   screen, and changing them changes what's rendered (not a static
 *   string a deleted feature could still pass);
 * - an upgrade link is rendered into the billing plan picker, carrying the
 *   offending resource as a query param (the app now has a billing surface);
 * - `otherWritesSucceeded` changes the copy: 0 (the default) says nothing
 *   else in the save was applied; a positive count says what was actually
 *   kept, rather than wording the alert as though nothing was written.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverLimitAlert } from './over-limit-alert';
import type { OverLimitErrorBody } from '@/lib/utils/api-errors';

function makeError(
  overrides: Partial<OverLimitErrorBody> = {}
): OverLimitErrorBody {
  return {
    code: 'limit_exceeded',
    resource: 'availability_windows',
    current_usage: 50,
    limit: 50,
    detail: 'Organization is at its limit for availability windows.',
    ...overrides,
  };
}

describe('OverLimitAlert', () => {
  it('renders resource, current_usage, and limit from the body', () => {
    render(<OverLimitAlert error={makeError()} />);

    expect(screen.getByText(/availability windows/)).toBeInTheDocument();
    expect(screen.getByText(/50 of 50 used/)).toBeInTheDocument();
  });

  it('reflects a different body rather than a fixed string', () => {
    render(
      <OverLimitAlert
        error={makeError({
          resource: 'blocked_time',
          current_usage: 12,
          limit: 10,
        })}
      />
    );

    expect(screen.getByText(/blocked time/)).toBeInTheDocument();
    expect(screen.getByText(/12 of 10 used/)).toBeInTheDocument();
    expect(screen.queryByText(/50 of 50/)).not.toBeInTheDocument();
  });

  it('deep-links into the billing plan picker carrying the offending resource', () => {
    render(<OverLimitAlert error={makeError({ resource: 'blocked_time' })} />);

    const link = screen.getByRole('link', { name: /upgrade/i });
    expect(link).toHaveAttribute(
      'href',
      '/billing/plans?resource=blocked_time'
    );
  });

  it('states nothing else was applied when no other write succeeded', () => {
    render(<OverLimitAlert error={makeError()} />);

    expect(
      screen.getByText(/nothing else in this save was applied/i)
    ).toBeInTheDocument();
  });

  it('states what else was kept when other writes in the batch succeeded', () => {
    render(<OverLimitAlert error={makeError()} otherWritesSucceeded={2} />);

    expect(
      screen.getByText(
        /2 other changes in this save already went through and were kept/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/nothing else in this save was applied/i)
    ).not.toBeInTheDocument();
  });
});
