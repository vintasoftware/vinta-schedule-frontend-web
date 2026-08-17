/**
 * derive-remedy.test.ts — `deriveRemedy` (Phase 8's documented default
 * table) and `remedyToRoute` (the remedy → destination map).
 */

import { describe, it, expect } from 'vitest';

import { deriveRemedy, remedyToRoute, type Remedy } from './derive-remedy';

const alwaysPurchasable = () => true;
const neverPurchasable = () => false;

describe('deriveRemedy', () => {
  it('routes to resolve_billing when the org is in grace, regardless of add-on purchasability', () => {
    expect(deriveRemedy('event_occurrences', 'grace', alwaysPurchasable)).toBe(
      'resolve_billing'
    );
    expect(deriveRemedy('event_occurrences', 'grace', neverPurchasable)).toBe(
      'resolve_billing'
    );
  });

  it('routes to resolve_billing when the org is restricted, regardless of add-on purchasability', () => {
    expect(
      deriveRemedy('event_occurrences', 'restricted', alwaysPurchasable)
    ).toBe('resolve_billing');
    expect(
      deriveRemedy('event_occurrences', 'restricted', neverPurchasable)
    ).toBe('resolve_billing');
  });

  it('routes to purchase_add_on for an active org on an add-on-purchasable resource', () => {
    expect(deriveRemedy('event_occurrences', 'active', alwaysPurchasable)).toBe(
      'purchase_add_on'
    );
  });

  it('routes to upgrade_plan for an active org on a resource that cannot be bought as an add-on', () => {
    expect(deriveRemedy('calendar_groups', 'active', neverPurchasable)).toBe(
      'upgrade_plan'
    );
  });

  it('routes to upgrade_plan for a free org (no billing_state) that cannot buy an add-on', () => {
    expect(deriveRemedy('calendar_groups', null, neverPurchasable)).toBe(
      'upgrade_plan'
    );
    expect(deriveRemedy('calendar_groups', undefined, neverPurchasable)).toBe(
      'upgrade_plan'
    );
  });

  it('routes to purchase_add_on for a free org (no billing_state) on an add-on-purchasable resource', () => {
    expect(deriveRemedy('event_occurrences', null, alwaysPurchasable)).toBe(
      'purchase_add_on'
    );
  });

  it('passes the offending resource to the isAddOnPurchasable callback', () => {
    let seen: string | null = null;
    deriveRemedy('webhook_subscriptions', 'active', (resource) => {
      seen = resource;
      return false;
    });
    expect(seen).toBe('webhook_subscriptions');
  });
});

describe('remedyToRoute', () => {
  it('maps upgrade_plan to the plans catalog with the resource in the query string', () => {
    expect(remedyToRoute('upgrade_plan', 'calendar_groups')).toEqual({
      remedy: 'upgrade_plan',
      href: '/billing/plans?resource=calendar_groups',
      resource: 'calendar_groups',
    });
  });

  it('maps upgrade_plan with no resource to the bare plans catalog', () => {
    expect(remedyToRoute('upgrade_plan')).toEqual({
      remedy: 'upgrade_plan',
      href: '/billing/plans',
      resource: undefined,
    });
  });

  it('maps resolve_billing to the resolve-payment surface', () => {
    expect(remedyToRoute('resolve_billing', 'event_occurrences')).toEqual({
      remedy: 'resolve_billing',
      href: '/billing/resolve-payment',
      resource: 'event_occurrences',
    });
  });

  it('maps purchase_add_on to the generic billing fallback (RemedyRouter opens the dialog directly)', () => {
    expect(remedyToRoute('purchase_add_on', 'event_occurrences')).toEqual({
      remedy: 'purchase_add_on',
      href: '/billing',
      resource: 'event_occurrences',
    });
  });

  it('maps add_payment_method to the generic billing fallback', () => {
    expect(remedyToRoute('add_payment_method')).toEqual({
      remedy: 'add_payment_method',
      href: '/billing',
      resource: undefined,
    });
  });

  it('falls back an unrecognized remedy to the generic "manage billing" destination', () => {
    const unknown = 'some_future_remedy' as Remedy;
    expect(remedyToRoute(unknown, 'calendar_groups')).toEqual({
      remedy: unknown,
      href: '/billing',
      resource: 'calendar_groups',
    });
  });
});
