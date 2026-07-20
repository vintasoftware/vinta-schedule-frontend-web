import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FileClock,
  GitBranch,
  KeyRound,
  Lock,
  Server,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

import { Button } from 'vinta-schedule-design-system/ui/button';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import {
  Box,
  Center,
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
  FeatureCard,
  MarketingSection,
  PageHero,
  SectionIntro,
} from '@/components/marketing/marketing-ui';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'Vinta Schedule is self-hosted by design: your scheduling data stays on your own infrastructure, with audit logs, per-resource access, and scoped API tokens.',
};

const controls = [
  {
    icon: FileClock,
    title: 'Audit logs on everything',
    body: 'Every booking, change, and cancellation is recorded — who did what, when, and to which calendar.',
  },
  {
    icon: UserCheck,
    title: 'Per-resource access',
    body: 'Grant access at the calendar and resource level, so people and integrations only reach what they should.',
  },
  {
    icon: KeyRound,
    title: 'Scoped API tokens',
    body: 'Public API tokens are scoped to the exact resources an org admin selects when creating them — nothing more.',
  },
  {
    icon: Lock,
    title: 'Session-only credentials',
    body: 'The docs explorer holds a pasted credential in memory for the tab only — never written to browser storage.',
  },
  {
    icon: ShieldCheck,
    title: 'Least-privilege by default',
    body: 'New tokens and connections start with no access. You opt resources in, rather than locking them down after.',
  },
  {
    icon: GitBranch,
    title: 'Open source',
    body: 'The platform is open — review the code, audit the data flows, and run exactly what you have inspected.',
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow='Security & trust'
        title={
          <>
            Your schedule data,{' '}
            <Text as='span' color='primary'>
              on your infrastructure.
            </Text>
          </>
        }
        lead='Vinta Schedule is self-hosted by design. Run the whole platform in your own environment, keep patient data under your control, and audit every change.'
        primary={{ label: 'Read the self-hosting guide', href: '/docs/getting-started' }}
        secondary={{ label: 'Privacy policy', href: '/privacy' }}
      />

      <Divider />

      {/* Self-hosted highlight */}
      <MarketingSection>
        <Grid columns={{ base: 1, lg: 2 }} gap={12} align='center'>
          <VStack gap={4}>
            <SectionIntro
              eyebrow='Data residency'
              title='Data that never leaves your walls.'
              lead='Because you host Vinta yourself, scheduling and calendar data lives on infrastructure you own and operate. There is no shared multi-tenant database to reason about.'
            />
            <Box pt={2}>
              <List variant='plain' gap={3}>
                {[
                  'Runs entirely on your own infrastructure',
                  'No per-seat, per-calendar, or per-booking data sharing',
                  'You control backups, retention, and residency',
                  'Bring your own identity and network boundaries',
                ].map((t) => (
                  <ListItem key={t}>
                    <HStack gap={3}>
                      <Icon icon={ShieldCheck} size='sm' color='success' />
                      <Text size='sm'>{t}</Text>
                    </HStack>
                  </ListItem>
                ))}
              </List>
            </Box>
          </VStack>
          <Box
            p={8}
            radius='2xl'
            border
            bg='card'
            borderColor='primary'
            shadow='lg'
          >
            <VStack gap={5} align='center'>
              <Center width={64} height={64} radius='2xl' bg='vinta-50'>
                <Icon icon={Server} size='lg' color='primary' />
              </Center>
              <VStack gap={1} align='center'>
                <Heading level={3} size='lg' align='center'>
                  Self-hosted
                </Heading>
                <Text as='p' size='sm' align='center' color='muted-foreground'>
                  Your servers · your database · your rules
                </Text>
              </VStack>
            </VStack>
          </Box>
        </Grid>
      </MarketingSection>

      <Divider />

      {/* Controls grid */}
      <MarketingSection bg='card'>
        <SectionIntro
          eyebrow='Controls'
          title='Least privilege, all the way down.'
          align='center'
        />
        <Grid columns={{ base: 1, sm: 2, lg: 3 }} gap={5} mt={12}>
          {controls.map((c) => (
            <FeatureCard key={c.title} icon={c.icon} title={c.title}>
              {c.body}
            </FeatureCard>
          ))}
        </Grid>
      </MarketingSection>

      <Divider />

      {/* Trust links */}
      <MarketingSection>
        <Box mx='auto' maxWidth='42rem'>
          <VStack gap={5} align='center'>
            <Heading level={2} size='2xl' align='center' className='md:text-3xl'>
              Reporting & policies
            </Heading>
            <Text as='p' align='center' color='muted-foreground' leading='relaxed'>
              Read how we handle data, review the terms of service, or check
              current platform status. To report a vulnerability, reach the team
              through our contact page.
            </Text>
            <Flex wrap align='center' justify='center' gap={5}>
              <TextLink asChild>
                <Link href='/privacy'>Privacy policy</Link>
              </TextLink>
              <TextLink asChild>
                <Link href='/terms'>Terms of service</Link>
              </TextLink>
              <TextLink href='https://status.schedule.vintasoftware.com/'>
                Platform status
              </TextLink>
            </Flex>
            <Box pt={2}>
              <Button asChild variant='outline'>
                <Link href='https://www.vintasoftware.com/contact'>
                  Report a vulnerability
                </Link>
              </Button>
            </Box>
          </VStack>
        </Box>
      </MarketingSection>

      <CtaBand
        title='Own your scheduling, end to end.'
        lead='Self-host Vinta Schedule and keep every calendar and booking under your control.'
        primary={{ label: 'Start self-hosting', href: '/docs/getting-started' }}
        secondary={{ label: 'Talk to us', href: 'https://www.vintasoftware.com/contact' }}
      />
    </>
  );
}
