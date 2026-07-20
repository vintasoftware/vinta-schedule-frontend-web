import type { Metadata } from 'next';
import {
  CalendarCheck,
  Layers,
  MapPin,
  Plug,
  Repeat,
  Route,
  Stethoscope,
  UsersRound,
} from 'lucide-react';

import { Icon } from 'vinta-schedule-design-system/ui/icon';
import {
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
  FeatureCard,
  MarketingSection,
  PageHero,
  SectionIntro,
} from '@/components/marketing/marketing-ui';

export const metadata: Metadata = {
  title: 'Calendar Groups',
  description:
    'Bundle the providers, rooms, and equipment that fulfill an appointment type behind one bookable link. Vinta resolves the right availability for every request.',
};

const steps = [
  {
    n: '01',
    icon: Plug,
    title: 'Add the calendars',
    body: 'Pull in every provider, room, and piece of equipment an appointment type can use — from any connected source.',
  },
  {
    n: '02',
    icon: UsersRound,
    title: 'Define the group',
    body: 'Set the matching rules: who can perform the service, which rooms qualify, and the constraints that must hold together.',
  },
  {
    n: '03',
    icon: CalendarCheck,
    title: 'Take bookings',
    body: 'Query the group for live availability. Vinta picks a valid combination and writes the event back to every calendar.',
  },
];

const useCases = [
  {
    icon: Stethoscope,
    title: 'Any available provider',
    body: 'Let patients book the first open slot across a pool of clinicians instead of hunting through individual calendars.',
  },
  {
    icon: MapPin,
    title: 'Provider + room together',
    body: 'Require a qualified provider and an available exam room at the same time — resolved in a single request.',
  },
  {
    icon: Route,
    title: 'Multi-resource visits',
    body: 'Coordinate appointments that need a clinician, equipment, and a space to all line up before the slot is offered.',
  },
  {
    icon: Repeat,
    title: 'Recurring & follow-ups',
    body: 'Honor working hours, buffers, and lead times so recurring visits never collide with existing commitments.',
  },
];

export default function CalendarGroupsPage() {
  return (
    <>
      <PageHero
        eyebrow='Calendar Groups'
        title={
          <>
            One bookable link for{' '}
            <Text as='span' color='primary'>
              every provider and room.
            </Text>
          </>
        }
        lead='A Calendar Group bundles the people, rooms, and equipment that can fulfill an appointment type. Patients reach one link; Vinta resolves who and what is actually free.'
        primary={{ label: 'Start building', href: '/auth/signup' }}
        secondary={{
          label: 'Concept guide',
          href: '/docs/concepts/calendar-groups',
          icon: Layers,
        }}
      />

      <Divider />

      <MarketingSection>
        <SectionIntro
          eyebrow='How it works'
          title='Availability, resolved for you.'
          lead='Stop asking patients to pick a person. Describe the service once, and let the group figure out every valid combination.'
        />
        <Grid columns={{ base: 1, md: 3 }} gap={6} mt={12}>
          {steps.map((s) => (
            <VStack key={s.n} gap={4}>
              <HStack gap={3}>
                <Center
                  width={44}
                  height={44}
                  radius='xl'
                  border
                  bg='card'
                  shadow='sm'
                >
                  <Icon icon={s.icon} size='md' color='primary' />
                </Center>
                <Text family='mono' size='sm' weight='semibold' color='slate-300'>
                  {s.n}
                </Text>
              </HStack>
              <VStack gap={1}>
                <Heading level={3} size='lg'>
                  {s.title}
                </Heading>
                <Text as='p' size='sm' color='muted-foreground' leading='relaxed'>
                  {s.body}
                </Text>
              </VStack>
            </VStack>
          ))}
        </Grid>
      </MarketingSection>

      <Divider />

      <MarketingSection bg='card'>
        <SectionIntro
          eyebrow='Use cases'
          title='Built for how care teams actually schedule.'
          align='center'
        />
        <Grid columns={{ base: 1, sm: 2 }} gap={5} mt={12}>
          {useCases.map((u) => (
            <FeatureCard key={u.title} icon={u.icon} title={u.title}>
              {u.body}
            </FeatureCard>
          ))}
        </Grid>
      </MarketingSection>

      <CtaBand
        title='Route every appointment to the right availability.'
        lead='Model your services as Calendar Groups and let Vinta handle the matching.'
        primary={{ label: 'Start building', href: '/auth/signup' }}
        secondary={{ label: 'Read the concept guide', href: '/docs/concepts/calendar-groups' }}
      />
    </>
  );
}
