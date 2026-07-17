import type { Metadata } from 'next';
import Link from 'next/link';

import {
  Box,
  Flex,
  Heading,
  Stack,
  Text,
} from 'vinta-schedule-design-system/layout';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
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
        <Stack gap={4}>
          <Heading level={2}>Event Types</Heading>
          <Text color='muted-foreground'>
            Your integration can register webhooks to receive these events via
            HTTP POST. Events are delivered at least once: failed deliveries are
            retried automatically (up to 5 attempts, with exponential backoff)
            and ordering is not guaranteed, so a retry can arrive after the
            first attempt at a later event. Dedupe using the id field on the
            payload envelope, which stays the same across the original delivery
            and every retry of it.
          </Text>

          <Stack gap={6}>
            {events.map((event) => (
              <Box key={event.value} borderLeft={2} pl={4}>
                <Flex align='baseline' gap={2} mb={2}>
                  <Badge variant='outline' className='font-mono'>
                    {event.value}
                  </Badge>
                  <Text size='sm' color='muted-foreground'>
                    {event.label}
                  </Text>
                </Flex>
                <Text size='sm'>{event.description}</Text>
              </Box>
            ))}
          </Stack>
        </Stack>

        <Box borderTop pt={6}>
          <Stack gap={4}>
            <Heading level={2}>Configuration</Heading>
            <Text color='muted-foreground'>
              Use the GraphQL API to manage webhook subscriptions. See the types
              below for details:
            </Text>

            <List variant='bullet' gap={2}>
              <ListItem>
                <TextLink asChild>
                  <Link href='/docs/reference/types/WebhookConfigurationGraphQLType'>
                    WebhookConfigurationGraphQLType
                  </Link>
                </TextLink>
                — Represents a webhook endpoint configuration and its subscribed
                events.
              </ListItem>
              <ListItem>
                <TextLink asChild>
                  <Link href='/docs/reference/types/WebhookEventGraphQLType'>
                    WebhookEventGraphQLType
                  </Link>
                </TextLink>
                — Represents a single delivered webhook event and its status.
              </ListItem>
            </List>
          </Stack>
        </Box>
      </Stack>
    </Stack>
  );
}
