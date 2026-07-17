import type { Metadata } from 'next';
import Link from 'next/link';

import { Heading, Stack, Text } from 'vinta-schedule-design-system/layout';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { getWebhookEvents } from '@/lib/docs/fetch-webhook-events';

export const metadata: Metadata = {
  title: 'Webhooks',
  description:
    'The outbound event catalog and the webhook configuration types.',
};

/**
 * Webhooks reference — documents the seven outbound webhook event types and
 * links to the relevant GraphQL configuration types.
 */
export default async function WebhooksPage() {
  const { events } = await getWebhookEvents();

  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Heading level={1}>Webhooks</Heading>
        <Text color='muted-foreground'>
          Outbound events your integration can subscribe to, and the GraphQL
          types for webhook configuration.
        </Text>
      </Stack>

      <Stack gap={4}>
        <div>
          <Heading level={2} className='mb-4'>
            Event Types
          </Heading>
          <Text color='muted-foreground' className='mb-6'>
            Your integration can register webhooks to receive these events via
            HTTP POST. Events are delivered in chronological order, but at least
            once (deduplication is your responsibility).
          </Text>

          <Stack gap={6}>
            {events.map((event) => (
              <div key={event.value} className='border-border border-l-2 pl-4'>
                <div className='mb-2 flex items-baseline gap-2'>
                  <Badge variant='outline' className='font-mono text-xs'>
                    {event.value}
                  </Badge>
                  <Text className='text-muted-foreground text-sm'>
                    {event.label}
                  </Text>
                </div>
                <Text className='text-sm'>{event.description}</Text>
              </div>
            ))}
          </Stack>
        </div>

        <div className='border-border border-t pt-6'>
          <Heading level={2} className='mb-4'>
            Configuration
          </Heading>
          <Text color='muted-foreground' className='mb-4'>
            Use the GraphQL API to manage webhook subscriptions. See the types
            below for details:
          </Text>

          <ul className='list-inside list-disc space-y-2 text-sm'>
            <li>
              <TextLink asChild>
                <Link href='/docs/reference/types/WebhookConfigurationGraphQLType'>
                  WebhookConfigurationGraphQLType
                </Link>
              </TextLink>
              — Represents a webhook endpoint configuration and its subscribed
              events.
            </li>
            <li>
              <TextLink asChild>
                <Link href='/docs/reference/types/WebhookEventGraphQLType'>
                  WebhookEventGraphQLType
                </Link>
              </TextLink>
              — Represents a single delivered webhook event and its status.
            </li>
          </ul>
        </div>
      </Stack>
    </Stack>
  );
}
