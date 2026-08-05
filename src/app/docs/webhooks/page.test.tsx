import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import webhookEventsSnapshot from '@/lib/docs/__generated__/webhook-events.json';
import type { WebhookEventsResult } from '@/lib/docs/fetch-webhook-events';

const getWebhookEvents = vi.fn();
vi.mock('@/lib/docs/fetch-webhook-events', () => ({
  getWebhookEvents: (...args: unknown[]) => getWebhookEvents(...args),
}));

import WebhooksPage from './page';

const SNAPSHOT_RESULT: WebhookEventsResult = {
  events: webhookEventsSnapshot,
  source: 'snapshot',
};

const EVENT_VALUES = [
  'calendar_event_created',
  'calendar_event_updated',
  'calendar_event_deleted',
  'calendar_event_attendee_added',
  'calendar_event_attendee_removed',
  'calendar_event_attendee_updated',
  'organization_member_created',
] as const;

describe('WebhooksPage', () => {
  beforeEach(() => {
    getWebhookEvents.mockReset();
    getWebhookEvents.mockResolvedValue(SNAPSHOT_RESULT);
  });

  it('renders all webhook events from the snapshot', async () => {
    render(await WebhooksPage());

    expect(screen.getByText('Webhooks')).toBeInTheDocument();

    for (const value of EVENT_VALUES) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }

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

    expect(EVENT_VALUES.every((val) => screen.getByText(val))).toBe(true);
  });
});
