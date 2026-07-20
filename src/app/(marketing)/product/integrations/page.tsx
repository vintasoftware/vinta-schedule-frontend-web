import type { Metadata } from 'next';
import {
  CalendarSync,
  Check,
  DoorOpen,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Video,
  Webhook,
} from 'lucide-react';

import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
import {
  Box,
  Center,
  Divider,
  Grid,
  HStack,
  Heading,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';
import {
  CtaBand,
  Eyebrow,
  FeatureCard,
  MarketingSection,
  PageHero,
  SectionIntro,
} from '@/components/marketing/marketing-ui';

export const metadata: Metadata = {
  title: 'Integrations',
  description:
    'Two-way sync with Google Calendar and Microsoft 365, plus resource, room, and virtual calendars. Every booking stays consistent everywhere within seconds.',
};

const sources = [
  {
    icon: CalendarSync,
    title: 'Google Calendar',
    body: 'Connect staff Google and Workspace calendars. Events flow both ways so personal commitments block availability automatically.',
  },
  {
    icon: CalendarSync,
    title: 'Microsoft 365',
    body: 'Link Outlook and Microsoft 365 calendars with the same two-way sync — no plugins, no manual imports.',
  },
  {
    icon: DoorOpen,
    title: 'Resource calendars',
    body: 'Model exam rooms, chairs, and equipment as their own calendars so a booking reserves the space, not just the person.',
  },
  {
    icon: Video,
    title: 'Virtual calendars',
    body: 'Create calendars that exist only in Vinta for telehealth queues or services with no underlying provider inbox.',
  },
  {
    icon: Webhook,
    title: 'Webhooks',
    body: 'Subscribe to every booking, change, and cancellation to keep your EHR, CRM, or data warehouse in step.',
  },
  {
    icon: Monitor,
    title: 'GraphQL API',
    body: 'Read and write availability, bookings, and calendar connections programmatically from your own product.',
  },
];

export default function IntegrationsPage() {
  return (
    <>
      <PageHero
        eyebrow='Integrations'
        title={
          <>
            Every calendar,{' '}
            <Text as='span' color='primary'>
              always in sync.
            </Text>
          </>
        }
        lead='Connect the calendars your team already lives in. Vinta reconciles them into one source of truth and writes every booking back — both ways, within seconds.'
        primary={{ label: 'Connect a calendar', href: '/auth/signup' }}
        secondary={{ label: 'Read the API docs', href: '/docs' }}
      />

      <Divider />

      <MarketingSection>
        <SectionIntro
          eyebrow='What connects'
          title='Bring the calendars you already use.'
          lead='Personal, resource, and virtual calendars all aggregate into one availability layer — no source is a second-class citizen.'
        />
        <Grid columns={{ base: 1, sm: 2, lg: 3 }} gap={5} mt={12}>
          {sources.map((s) => (
            <FeatureCard key={s.title} icon={s.icon} title={s.title}>
              {s.body}
            </FeatureCard>
          ))}
        </Grid>
      </MarketingSection>

      <Divider />

      {/* Two-way sync explainer */}
      <MarketingSection bg='card'>
        <Grid columns={{ base: 1, lg: 2 }} gap={12} align='center'>
          <VStack gap={4}>
            <SectionIntro
              eyebrow='Two-way sync'
              title='No double bookings, no stale slots.'
              lead='When anything changes on a connected calendar, Vinta reflects it in seconds. When a booking lands in Vinta, it writes back to every calendar in the group.'
            />
            <Box pt={2}>
              <List variant='plain' gap={3}>
                {[
                  'Changes propagate in seconds, in both directions',
                  'External busy events block availability automatically',
                  'Bookings write back to every calendar in the group',
                  'Conflicts are resolved before a slot is ever offered',
                ].map((t) => (
                  <ListItem key={t}>
                    <HStack gap={3}>
                      <Icon icon={Check} size='sm' color='success' />
                      <Text size='sm'>{t}</Text>
                    </HStack>
                  </ListItem>
                ))}
              </List>
            </Box>
          </VStack>
          <Box p={8} radius='2xl' border bg='background' shadow='sm'>
            <VStack gap={5} align='center'>
              <Center width={64} height={64} radius='2xl' bg='vinta-50'>
                <Icon icon={RefreshCw} size='lg' color='primary' />
              </Center>
              <VStack gap={1} align='center'>
                <Text size='4xl' weight='bold' leading='none' tracking='tight'>
                  Seconds
                </Text>
                <Text size='sm' color='muted-foreground'>
                  from change to synced everywhere
                </Text>
              </VStack>
              <HStack gap={2}>
                <Icon icon={ShieldCheck} size='sm' color='success' />
                <Text size='sm' color='muted-foreground'>
                  Every write is audit-logged
                </Text>
              </HStack>
            </VStack>
          </Box>
        </Grid>
      </MarketingSection>

      <Divider />

      <MarketingSection>
        <Box mx='auto' maxWidth='42rem'>
          <VStack gap={4} align='center'>
            <Eyebrow align='center'>Don&apos;t see your source?</Eyebrow>
            <Heading level={2} size='2xl' align='center' className='md:text-3xl'>
              If it speaks calendars, it can connect.
            </Heading>
            <Text as='p' align='center' color='muted-foreground' leading='relaxed'>
              The same GraphQL API that powers our built-in integrations is open
              to you — model any source as a calendar and sync it through Vinta.
            </Text>
          </VStack>
        </Box>
      </MarketingSection>

      <CtaBand
        title='Connect your calendars in minutes.'
        lead='Link Google or Microsoft, add your rooms, and start booking across all of them.'
        primary={{ label: 'Get started free', href: '/auth/signup' }}
        secondary={{ label: 'See the webhooks', href: '/docs/webhooks' }}
      />
    </>
  );
}
