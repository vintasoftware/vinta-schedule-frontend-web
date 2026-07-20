import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarSync,
  Check,
  KeyRound,
  Layers,
  Plug,
  ShieldCheck,
  UsersRound,
  Webhook,
} from 'lucide-react';

import { Button } from 'vinta-schedule-design-system/ui/button';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
import {
  Box,
  Center,
  Container,
  Divider,
  Flex,
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
  SectionIntro,
} from '@/components/marketing/marketing-ui';

export const metadata: Metadata = {
  title: 'Product',
  description:
    'Vinta Schedule aggregates every calendar in your organization and makes it bookable through one API — availability, booking, and two-way sync included.',
};

const capabilities = [
  {
    icon: CalendarSync,
    title: 'Calendar aggregation',
    body: 'Connect Google, Microsoft, resource, and virtual calendars. Vinta keeps them in sync within seconds, both ways.',
  },
  {
    icon: UsersRound,
    title: 'Calendar Groups',
    body: 'Bundle the providers and rooms that fulfill an appointment type, so patients always reach the right availability.',
  },
  {
    icon: Webhook,
    title: 'One booking API',
    body: 'Search availability, hold slots, and confirm bookings through one GraphQL endpoint with webhooks for every event.',
  },
  {
    icon: KeyRound,
    title: 'Booking codes',
    body: 'Issue single-use, tokenless links so patients can self-schedule without ever creating an account.',
  },
  {
    icon: CalendarCheck,
    title: 'Availability engine',
    body: 'Working hours, buffers, lead times, and recurrence resolve to real, conflict-free slots across every calendar.',
  },
  {
    icon: ShieldCheck,
    title: 'Built for healthcare',
    body: 'Audit logs on every change and granular, per-resource access — designed for the way care teams schedule.',
  },
];

const explore = [
  {
    icon: UsersRound,
    title: 'Calendar Groups',
    body: 'Route one appointment type across many providers and rooms behind a single bookable link.',
    href: '/product/calendar-groups',
  },
  {
    icon: Plug,
    title: 'Integrations',
    body: 'Two-way sync with Google and Microsoft, plus resource and virtual calendars — no double bookings.',
    href: '/product/integrations',
  },
];

export default function ProductPage() {
  return (
    <>
      {/* Hero */}
      <Box as='section' position='relative' overflow='hidden'>
        <Box
          position='absolute'
          className='grid-bg'
          style={{
            inset: 0,
            opacity: 0.6,
            maskImage:
              'radial-gradient(120% 80% at 50% 0%, black, transparent 70%)',
          }}
        />
        <Container position='relative' pt={{ base: 20, md: 24 }} pb={{ base: 16, md: 20 }}>
          <Box mx='auto' maxWidth='48rem'>
            <VStack gap={5} align='center'>
              <Eyebrow dot align='center'>
                The platform
              </Eyebrow>
              {/* Heading size is not Responsive<TextSize> — md: step stays a class. */}
              <Heading
                level={1}
                size='4xl'
                align='center'
                className='text-balance md:text-6xl'
              >
                Every calendar in your organization,{' '}
                <Text as='span' color='primary'>
                  bookable through one API.
                </Text>
              </Heading>
              <Box maxWidth='38rem'>
                <Text
                  as='p'
                  size='lg'
                  align='center'
                  color='muted-foreground'
                  leading='relaxed'
                >
                  Vinta Schedule aggregates personal, resource, and virtual
                  calendars, resolves real availability, and books across every
                  one of them — so your team can build the scheduling experience
                  patients actually want.
                </Text>
              </Box>
              <Flex wrap align='center' justify='center' gap={3} pt={2}>
                <Button asChild size='lg'>
                  <Link href='/auth/signup'>
                    Start building
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant='outline' size='lg'>
                  <Link href='/docs'>
                    <BookOpen />
                    Read the API docs
                  </Link>
                </Button>
              </Flex>
            </VStack>
          </Box>
        </Container>
      </Box>

      <Divider />

      {/* Capabilities */}
      <MarketingSection>
        <SectionIntro
          eyebrow='What you get'
          title='Scheduling infrastructure, not another calendar app.'
          lead='You bring the calendars and the care model. Vinta handles aggregation, availability, and booking behind one clean API.'
        />
        <Grid columns={{ base: 1, sm: 2, lg: 3 }} gap={5} mt={12}>
          {capabilities.map((c) => (
            <FeatureCard key={c.title} icon={c.icon} title={c.title}>
              {c.body}
            </FeatureCard>
          ))}
        </Grid>
      </MarketingSection>

      <Divider />

      {/* Explore deeper */}
      <MarketingSection bg='card'>
        <SectionIntro
          eyebrow='Go deeper'
          title='Explore the platform.'
          align='center'
        />
        <Grid columns={{ base: 1, md: 2 }} gap={5} mt={12}>
          {explore.map((e) => (
            <Link key={e.href} href={e.href}>
              <Box
                p={6}
                radius='2xl'
                border
                bg='background'
                className='h-full transition-colors hover:border-primary'
              >
                <VStack gap={4}>
                  <Center width={44} height={44} radius='xl' bg='vinta-50'>
                    <Icon icon={e.icon} size='md' color='primary' />
                  </Center>
                  <VStack gap={1}>
                    <Heading level={3} size='lg'>
                      {e.title}
                    </Heading>
                    <Text
                      as='p'
                      size='sm'
                      color='muted-foreground'
                      leading='relaxed'
                    >
                      {e.body}
                    </Text>
                  </VStack>
                  <HStack gap={1} color='primary'>
                    <Text size='sm' weight='medium'>
                      Learn more
                    </Text>
                    <Icon icon={ArrowRight} size='sm' color='primary' />
                  </HStack>
                </VStack>
              </Box>
            </Link>
          ))}
        </Grid>
      </MarketingSection>

      <Divider />

      {/* Developer strip */}
      <MarketingSection>
        <Grid columns={{ base: 1, lg: 2 }} gap={12} align='center'>
          <VStack gap={4}>
            <SectionIntro
              eyebrow='For developers'
              title='Book a slot in one call.'
              lead='Query a Calendar Group for live availability, then confirm — Vinta resolves the right provider or room and writes back to every connected calendar.'
            />
            <Box pt={2}>
              <List variant='plain' gap={3}>
                {[
                  'One GraphQL endpoint + webhooks for every booking event',
                  'Calendar Groups resolve the right provider or room for you',
                  'Booking codes for single-use, tokenless public scheduling',
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
            <Box pt={2}>
              <Button asChild variant='outline'>
                <Link href='/docs/reference'>
                  <Layers />
                  Explore the schema
                </Link>
              </Button>
            </Box>
          </VStack>
          <Box
            overflow='hidden'
            radius='2xl'
            border
            borderColor='slate-800'
            shadow='xl'
          >
            <HStack gap={2} px={4} py={2} bg='slate-900'>
              <Box width={12} height={12} radius='full' bg='slate-700' />
              <Box width={12} height={12} radius='full' bg='slate-700' />
              <Box width={12} height={12} radius='full' bg='slate-700' />
              <Text size='xs' family='mono' color='slate-400'>
                booking.graphql
              </Text>
            </HStack>
            <Divider tone='slate-800' />
            <Box bg='slate-950' p={5} overflow='auto'>
              <Text
                as='pre'
                family='mono'
                size='sm'
                leading='relaxed'
                color='slate-100'
              >
                <Text as='span' color='slate-500'>
                  # find bookable slots in a Calendar Group
                </Text>
                {'\n'}
                <Text as='span' color='vinta-300'>
                  query
                </Text>{' '}
                {'{\n'}
                {'  '}
                <Text as='span' color='teal-300'>
                  calendarGroupBookableSlots
                </Text>
                (groupId: 42,{'\n'}
                {'    '}searchWindowStart:{' '}
                <Text as='span' color='teal-300'>
                  &quot;2026-06-17T09:00:00-07:00&quot;
                </Text>
                ,{'\n'}
                {'    '}durationSeconds: 1800){' { '}
                <Text as='span' color='vinta-300'>
                  startTime endTime
                </Text>
                {' }\n}'}
              </Text>
            </Box>
          </Box>
        </Grid>
      </MarketingSection>

      <CtaBand
        title="Bring your calendars. We'll handle the booking."
        lead='Start free, or talk to us about your care model. Most teams are live the same day.'
        primary={{ label: 'Start building', href: '/auth/signup' }}
        secondary={{ label: 'Read the docs', href: '/docs' }}
      />
    </>
  );
}
