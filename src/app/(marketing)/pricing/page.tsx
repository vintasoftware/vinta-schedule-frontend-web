import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, Server } from 'lucide-react';

import { Button } from 'vinta-schedule-design-system/ui/button';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
import {
  Box,
  Center,
  Divider,
  Flex,
  Grid,
  Heading,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';
import {
  CtaBand,
  MarketingSection,
  PageHero,
  SectionIntro,
} from '@/components/marketing/marketing-ui';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Vinta Schedule is completely free and self-hosted — every feature included, with no per-seat, per-calendar, or per-booking fees.',
};

const included = [
  'Every feature — no seat, calendar, or API limits',
  'Unlimited Calendar Groups & booking codes',
  'Full GraphQL booking API + webhooks',
  'Two-way sync for every connected calendar',
  'Audit logs and per-resource access control',
  'Your data stays on your own infrastructure',
];

const faqs = [
  {
    q: 'Is it really free?',
    a: 'Yes. Vinta Schedule is completely free and self-hosted. There are no per-seat, per-calendar, or per-booking fees, and every feature is included.',
  },
  {
    q: 'What does "self-hosted" mean for me?',
    a: 'You run the platform on your own infrastructure. Your scheduling and calendar data lives on servers you own and operate — you control backups, retention, and residency.',
  },
  {
    q: 'Are there usage limits?',
    a: 'No artificial caps. Because you host it, the only limits are the resources of the infrastructure you run it on.',
  },
  {
    q: 'Do you offer a managed/hosted plan?',
    a: 'Managed hosting is not offered today. If your team needs it, reach out through our contact page and tell us about your care model.',
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow='Pricing'
        title={
          <>
            Free, and{' '}
            <Text as='span' color='primary'>
              self-hosted.
            </Text>
          </>
        }
        lead='Run the whole platform on your own infrastructure, with every feature included and no per-seat, per-calendar, or per-booking fees.'
      />

      {/* Plan card */}
      <MarketingSection py={{ base: 4, md: 8 }}>
        <Box mx='auto' maxWidth='32rem'>
          <Box
            position='relative'
            p={8}
            radius='2xl'
            border
            bg='card'
            borderColor='primary'
            shadow='lg'
          >
            <VStack gap={4}>
              <Center width={44} height={44} radius='xl' bg='vinta-50'>
                <Icon icon={Server} size='md' color='primary' />
              </Center>
              <VStack gap={1}>
                <Flex align='end' gap={2}>
                  <Text size='4xl' weight='bold' leading='none' tracking='tight'>
                    $0
                  </Text>
                  <Text size='sm' color='muted-foreground'>
                    forever
                  </Text>
                </Flex>
                <Text as='p' size='sm' color='muted-foreground'>
                  Self-hosted · open to every team
                </Text>
              </VStack>
              <List variant='plain' gap={3}>
                {included.map((f) => (
                  <ListItem key={f}>
                    <Flex align='start' gap={2}>
                      <Icon
                        icon={Check}
                        size='sm'
                        color='success'
                        style={{ marginTop: '0.125rem' }}
                      />
                      <Text size='sm'>{f}</Text>
                    </Flex>
                  </ListItem>
                ))}
              </List>
              <Box pt={2}>
                {/* Button has no width prop (shadcn atom) — fullWidth is the escape. */}
                <Button asChild fullWidth>
                  <Link href='/auth/signup'>
                    Get started free
                    <ArrowRight />
                  </Link>
                </Button>
              </Box>
              <Box>
                <Button asChild variant='outline' fullWidth>
                  <Link href='/docs/getting-started'>
                    Read the self-hosting guide
                  </Link>
                </Button>
              </Box>
            </VStack>
          </Box>
        </Box>
      </MarketingSection>

      <Divider />

      {/* FAQ */}
      <MarketingSection bg='card'>
        <SectionIntro eyebrow='FAQ' title='Questions, answered.' align='center' />
        <Box mx='auto' maxWidth='46rem' mt={12}>
          <Grid columns={{ base: 1, md: 2 }} gap={5}>
            {faqs.map((f) => (
              <Box key={f.q} p={6} radius='2xl' border bg='background'>
                <VStack gap={2}>
                  <Heading level={3} size='base'>
                    {f.q}
                  </Heading>
                  <Text as='p' size='sm' color='muted-foreground' leading='relaxed'>
                    {f.a}
                  </Text>
                </VStack>
              </Box>
            ))}
          </Grid>
        </Box>
      </MarketingSection>

      <CtaBand
        title='Start scheduling for free.'
        lead='Spin up Vinta Schedule on your own infrastructure and connect your first calendar today.'
        primary={{ label: 'Get started', href: '/auth/signup' }}
        secondary={{ label: 'Talk to us', href: 'https://www.vintasoftware.com/contact' }}
      />
    </>
  );
}
