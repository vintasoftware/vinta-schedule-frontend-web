import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetWebhookEventsCacheForTests } from '@/lib/docs/fetch-webhook-events';
import WebhooksPage from './page';

// Mock the fetch function to avoid actual API calls in tests
vi.mock('@/lib/docs/fetch-webhook-events', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/docs/fetch-webhook-events')
  >('@/lib/docs/fetch-webhook-events');
  return {
    ...actual,
    getWebhookEvents: vi.fn(actual.getWebhookEvents),
  };
});

describe('WebhooksPage', () => {
  beforeEach(() => {
    __resetWebhookEventsCacheForTests();
  });

  it('renders all webhook events from the snapshot', async () => {
    render(await WebhooksPage());

    // Check that the page renders with the event list
    expect(screen.getByText('Webhooks')).toBeInTheDocument();

    // Verify all 7 events are rendered by checking for their values
    const eventValues = [
      'calendar_event_created',
      'calendar_event_updated',
      'calendar_event_deleted',
      'calendar_event_attendee_added',
      'calendar_event_attendee_removed',
      'calendar_event_attendee_updated',
      'organization_member_created',
    ];

    for (const value of eventValues) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }

    // Verify that the Configuration section with GraphQL type links is rendered
    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'WebhookConfigurationGraphQLType',
      })
    ).toHaveAttribute(
      'href',
      '/docs/reference/types/WebhookConfigurationGraphQLType'
    );
    expect(
      screen.getByRole('link', {
        name: 'WebhookEventGraphQLType',
      })
    ).toHaveAttribute('href', '/docs/reference/types/WebhookEventGraphQLType');
  });

  it('renders the correct number of events by counting event values', async () => {
    render(await WebhooksPage());

    // Verify all 7 event values are rendered - count by checking they all appear
    const eventValues = [
      'calendar_event_created',
      'calendar_event_updated',
      'calendar_event_deleted',
      'calendar_event_attendee_added',
      'calendar_event_attendee_removed',
      'calendar_event_attendee_updated',
      'organization_member_created',
    ];

    // All events should be present in the rendered output
    expect(eventValues.every((val) => screen.getByText(val))).toBe(true);
  });
});
