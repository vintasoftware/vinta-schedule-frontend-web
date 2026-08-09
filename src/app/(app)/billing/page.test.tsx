/**
 * BillingPage (Phase 0 skeleton) tests.
 *
 * The page is a sync Server Component that reads no billing entitlement and
 * fetches nothing — Phase 0 ships only the route skeleton. This test asserts
 * it mounts without throwing (no billing data layer required) and renders its
 * placeholder heading. Real dashboard coverage lands with Phase 2's content.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BillingPage from './page';

describe('BillingPage (skeleton)', () => {
  it('mounts without a billing entitlement and renders the Billing heading', () => {
    expect(() => render(<BillingPage />)).not.toThrow();
    expect(screen.getByText('Billing')).toBeInTheDocument();
  });
});
