'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarSync,
  Check,
  Globe,
  Mail,
  Play,
  Plug,
  Rss,
  ShieldCheck,
  UsersRound,
  Webhook,
} from 'lucide-react';

import { Button } from 'vinta-schedule-design-system/ui/button';
import { Badge, BadgeDot } from 'vinta-schedule-design-system/ui/badge';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { Image } from 'vinta-schedule-design-system/ui/image';
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import {
  Box,
  Center,
  Container,
  Divider,
  Flex,
  Grid,
  HStack,
  Heading,
  Spacer,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';
import { Navbar, BrandMark } from 'vinta-schedule-design-system/layout/navbar';
import { ThemeToggle } from '@/components/navigation/theme-toggle';

/** White — not a design token; passed through as a raw CSS color. */
const WHITE = '#fff';
const WHITE_85 = 'rgb(255 255 255 / 0.85)';

function Eyebrow({
  dot,
  align = 'start',
  children,
}: {
  /** Leading status dot (hero eyebrow). */
  dot?: boolean;
  align?: 'start' | 'center';
  children: React.ReactNode;
}) {
  return (
    <Flex justify={align}>
      <Badge variant='info'>
        {dot ? <BadgeDot /> : null}
        <Text size='xs' weight='semibold' tracking='wider' uppercase>
          {children}
        </Text>
      </Badge>
    </Flex>
  );
}

/* ---------------------------------------------------------------- Nav */
function MarketingNav() {
  const links = ['Product', 'Calendar Groups', 'Developers', 'Pricing'];

  // Authenticated visitors see a "Dashboard" link instead of sign-in/up.
  // Resolved after mount to avoid an SSR/client hydration mismatch (localStorage
  // is client-only); defaults to the signed-out actions until then.
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  React.useEffect(() => {
    setIsAuthenticated(
      document.cookie.split('; ').some((c) => c.startsWith('sessionActive='))
    );
  }, []);

  return (
    <Navbar
      brand={
        <Link href='/'>
          <BrandMark />
        </Link>
      }
      links={links.map((l) => (
        <TextLink key={l} href='#' variant='muted' underline='none' size='md'>
          <Text weight='medium'>{l}</Text>
        </TextLink>
      ))}
      actions={
        <>
          <ThemeToggle />
          {isAuthenticated ? (
            <Button asChild size='sm'>
              <Link href='/dashboard'>Dashboard</Link>
            </Button>
          ) : (
            <>
              <Box display={{ base: 'hidden', sm: 'inline-flex' }}>
                <Button asChild variant='ghost' size='sm'>
                  <Link href='/auth/login'>Sign in</Link>
                </Button>
              </Box>
              <Button asChild size='sm'>
                <Link href='/auth/signup'>Sign up</Link>
              </Button>
            </>
          )}
        </>
      }
    />
  );
}

/* ---------------------------------------------------------------- Hero */
function Hero() {
  return (
    <Box as='section' position='relative' overflow='hidden'>
      <Box
        position='absolute'
        // `grid-bg` is a custom utility (tokens.css) with no token-prop
        // equivalent; the radial mask is likewise raw CSS.
        className='grid-bg'
        style={{
          inset: 0,
          opacity: 0.6,
          maskImage:
            'radial-gradient(120% 80% at 50% 0%, black, transparent 70%)',
        }}
      />
      <Container
        position='relative'
        pt={{ base: 20, md: 24 }}
        pb={{ base: 16, md: 24 }}
      >
        <Grid columns={{ base: 1, lg: 2 }} gap={12} align='center'>
          <VStack gap={5}>
            <Eyebrow dot>Calendar infrastructure for healthcare</Eyebrow>
            {/* TODO(ds-gap): Text/Heading `size` is not Responsive<TextSize>,
                so the md: step of the type ramp has to stay a utility class. */}
            <Heading level={1} size='4xl' className='text-balance md:text-6xl'>
              Every calendar in your organization,{' '}
              <Text as='span' color='primary'>
                bookable through one API.
              </Text>
            </Heading>
            <Box maxWidth='36rem'>
              <Text as='p' size='lg' color='muted-foreground' leading='relaxed'>
                Vinta Schedule aggregates personal, resource, and virtual
                calendars, then lets your patients find and book the right
                provider or room — in seconds, in sync, HIPAA-ready.
              </Text>
            </Box>
            <Flex wrap align='center' gap={3} pt={3}>
              <Button asChild size='lg'>
                <Link href='/auth/signup'>
                  Start building
                  <ArrowRight />
                </Link>
              </Button>
              <Button variant='outline' size='lg'>
                <Play />
                Watch the 2-min tour
              </Button>
            </Flex>
            <HStack gap={2} pt={1}>
              <Icon icon={ShieldCheck} size='sm' color='success' />
              <Text size='sm' color='muted-foreground'>
                HIPAA-compliant · SOC 2 Type II · 99.99% sync uptime
              </Text>
            </HStack>
          </VStack>
          <HeroMock />
        </Grid>
      </Container>
    </Box>
  );
}

function HeroMock() {
  const slots = ['9:00', '9:30', '10:30', '11:00', '1:30', '2:00'];
  const [sel, setSel] = React.useState('10:30');
  const days = ['Mon 15', 'Tue 16', 'Wed 17', 'Thu 18'];
  return (
    <Box position='relative'>
      <Box
        position='absolute'
        bg='vinta-50'
        radius='2xl'
        style={{ inset: '-1rem', transform: 'rotate(-1deg)' }}
      />
      <Box
        position='relative'
        overflow='hidden'
        radius='2xl'
        border
        bg='card'
        shadow='xl'
      >
        <HStack gap={3} px={5} pt={4} pb={3}>
          <Center width={32} height={32} radius='lg' bg='vinta-600'>
            <Text size='xs' weight='bold' color={WHITE}>
              Q
            </Text>
          </Center>
          <VStack gap={0}>
            <Text as='div' size='sm' weight='semibold' leading='tight'>
              Quilted Health
            </Text>
            <Text as='div' size='xs' color='muted-foreground' leading='tight'>
              Prenatal Intake · 30 min
            </Text>
          </VStack>
          <Spacer />
          <Badge variant='teal'>
            <BadgeDot />
            Live availability
          </Badge>
        </HStack>
        <Divider />
        <VStack gap={3} p={5}>
          <HStack gap={2}>
            {days.map((d, i) => (
              <Box
                key={d}
                grow
                basis={0}
                py={2}
                radius='lg'
                border
                textAlign='center'
                bg={i === 2 ? 'primary' : undefined}
                borderColor={i === 2 ? 'primary' : 'border'}
                color={i === 2 ? 'primary-foreground' : 'muted-foreground'}
              >
                <Text
                  as='div'
                  size='xs'
                  weight='medium'
                  style={{ opacity: 0.8 }}
                >
                  {d.split(' ')[0]}
                </Text>
                <Text as='div' size='sm' weight='semibold'>
                  {d.split(' ')[1]}
                </Text>
              </Box>
            ))}
          </HStack>
          <Text
            as='div'
            size='xs'
            weight='semibold'
            tracking='wide'
            uppercase
            color='muted-foreground'
          >
            Wed, Jun 17 · PT
          </Text>
          <Grid columns={3} gap={2}>
            {slots.map((s) => (
              <Button
                key={s}
                type='button'
                variant={sel === s ? 'default' : 'outline'}
                onClick={() => setSel(s)}
              >
                <Text family='mono'>{s}</Text>
              </Button>
            ))}
          </Grid>
          <Box pt={1}>
            {/* Button has no width prop (shadcn atom) — `w-full` is the escape. */}
            <Button type='button' size='lg' fullWidth>
              Confirm {sel} AM
              <ArrowRight />
            </Button>
          </Box>
        </VStack>
      </Box>
    </Box>
  );
}

/* ---------------------------------------------------------------- Logos */
function LogoCloud() {
  const names = [
    'Quilted Health',
    'Rewind',
    'Splendid Care',
    'Lastmile',
    'Medplum',
    'Northwind Clinic',
  ];
  return (
    <Box as='section' bg='background' py={12}>
      <Container>
        <VStack gap={6}>
          <Text
            as='p'
            size='sm'
            weight='medium'
            align='center'
            color='muted-foreground'
          >
            Scheduling for modern care teams
          </Text>
          <Flex wrap align='center' justify='center' columnGap={12} rowGap={5}>
            {names.map((n) => (
              <Text
                key={n}
                size='lg'
                weight='semibold'
                tracking='tight'
                color='slate-400'
              >
                {n}
              </Text>
            ))}
          </Flex>
        </VStack>
      </Container>
    </Box>
  );
}

/* ---------------------------------------------------------------- Features */
function Features() {
  const items = [
    {
      icon: CalendarSync,
      title: 'Aggregate every calendar',
      body: 'Connect Google, Microsoft, resource, and virtual calendars. We keep them in sync within seconds, both ways.',
    },
    {
      icon: UsersRound,
      title: 'Calendar Groups',
      body: 'Bundle the providers and rooms that fulfill an appointment type, so patients always reach the right availability.',
    },
    {
      icon: Webhook,
      title: 'One booking API',
      body: 'Search availability, hold slots, and confirm bookings with a clean REST API and webhooks for every event.',
    },
    {
      icon: ShieldCheck,
      title: 'Built for healthcare',
      body: 'HIPAA-compliant by default, audit logs on every change, and granular access for resources and staff.',
    },
  ];
  return (
    <Box as='section' py={{ base: 20, md: 24 }}>
      <Container>
        <Box maxWidth='42rem'>
          <VStack gap={4}>
            <Eyebrow>Why Vinta Schedule</Eyebrow>
            {/* TODO(ds-gap): no Responsive<TextSize> on Heading — see Hero. */}
            <Heading level={2} size='3xl' className='md:text-4xl'>
              Scheduling infrastructure, not another calendar app.
            </Heading>
            <Text as='p' size='lg' color='muted-foreground' leading='relaxed'>
              You bring the calendars and the care model. We handle aggregation,
              availability, and booking — so your team can build the experience
              patients actually want.
            </Text>
          </VStack>
        </Box>
        <Grid columns={{ base: 1, sm: 2, lg: 4 }} gap={5} mt={12}>
          {items.map((it) => {
            const Glyph = it.icon;
            return (
              <Box
                key={it.title}
                p={6}
                radius='2xl'
                border
                bg='card'
                // Hover elevation is a state, not expressible as a token prop.
                className='transition-shadow hover:shadow-md'
              >
                <VStack gap={4}>
                  <Center width={44} height={44} radius='xl' bg='vinta-50'>
                    <Icon icon={Glyph} size='md' color='primary' />
                  </Center>
                  <VStack gap={1}>
                    <Heading level={3} size='base'>
                      {it.title}
                    </Heading>
                    <Text
                      as='p'
                      size='sm'
                      color='muted-foreground'
                      leading='relaxed'
                    >
                      {it.body}
                    </Text>
                  </VStack>
                </VStack>
              </Box>
            );
          })}
        </Grid>
      </Container>
    </Box>
  );
}

/* ---------------------------------------------------------------- API showcase */
function ApiShowcase() {
  return (
    <Box as='section' bg='background' py={{ base: 20, md: 24 }}>
      <Container>
        <Grid columns={{ base: 1, lg: 2 }} gap={12} align='center'>
          <VStack gap={4}>
            <Eyebrow>For developers</Eyebrow>
            {/* TODO(ds-gap): no Responsive<TextSize> on Heading — see Hero. */}
            <Heading level={2} size='3xl' className='md:text-4xl'>
              Book a slot in one call.
            </Heading>
            <Box maxWidth='32rem'>
              <Text as='p' color='muted-foreground' leading='relaxed'>
                Query a Calendar Group for live availability, then confirm —
                Vinta resolves the right provider or resource and writes back to
                every connected calendar.
              </Text>
            </Box>
            <Box pt={2}>
              <List variant='plain' gap={3}>
                {[
                  'REST + webhooks for every booking event',
                  'Idempotent holds so slots never double-book',
                  'Typed SDKs for Python, Node & Go',
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
            <Box pt={3}>
              <Button variant='outline'>
                <BookOpen />
                Read the API docs
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
                booking.sh
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
                  # Find availability in a Calendar Group
                </Text>
                {'\n'}
                <Text as='span' color='teal-300'>
                  curl
                </Text>{' '}
                https://api.vinta.dev/v1/groups/
                <Text as='span' color='vinta-300'>
                  grp_8fk2
                </Text>
                /availability \{'\n'}
                {'  '}-d type=
                <Text as='span' color='teal-300'>
                  &quot;intake-30&quot;
                </Text>{' '}
                -d date=
                <Text as='span' color='teal-300'>
                  &quot;2026-06-17&quot;
                </Text>
                {'\n\n'}
                <Text as='span' color='slate-500'>
                  # → confirm the slot
                </Text>
                {'\n'}
                <Text as='span' color='teal-300'>
                  POST
                </Text>{' '}
                /v1/groups/grp_8fk2/bookings
                {'\n'}
                {'{ '}
                <Text as='span' color='vinta-300'>
                  &quot;start&quot;
                </Text>
                :{' '}
                <Text as='span' color='teal-300'>
                  &quot;2026-06-17T10:30-07:00&quot;
                </Text>
                ,{'\n'}
                {'  '}
                <Text as='span' color='vinta-300'>
                  &quot;patient&quot;
                </Text>
                :{' '}
                <Text as='span' color='teal-300'>
                  &quot;pat_1a2b&quot;
                </Text>{' '}
                {'}'}
                {'\n\n'}
                <Text as='span' color='slate-500'>
                  # ← 201 booked · synced to 3 calendars
                </Text>
              </Text>
            </Box>
          </Box>
        </Grid>
      </Container>
    </Box>
  );
}

/* ---------------------------------------------------------------- How it works */
function HowItWorks() {
  const steps = [
    {
      n: '01',
      icon: Plug,
      title: 'Connect calendars',
      body: 'Link staff, resource, and virtual calendars in a few clicks — or via the API.',
    },
    {
      n: '02',
      icon: UsersRound,
      title: 'Build a Calendar Group',
      body: 'Group the people and rooms that handle an appointment type behind one link.',
    },
    {
      n: '03',
      icon: CalendarCheck,
      title: 'Take bookings',
      body: 'Share a booking page or embed the API. Every booking syncs everywhere, instantly.',
    },
  ];
  return (
    <Box as='section' py={{ base: 20, md: 24 }}>
      <Container>
        <Box mx='auto' maxWidth='42rem'>
          <VStack gap={4}>
            <Eyebrow align='center'>How it works</Eyebrow>
            {/* TODO(ds-gap): no Responsive<TextSize> on Heading — see Hero. */}
            <Heading
              level={2}
              size='3xl'
              align='center'
              className='md:text-4xl'
            >
              Live in an afternoon.
            </Heading>
          </VStack>
        </Box>
        <Grid columns={{ base: 1, md: 3 }} gap={6} mt={12}>
          {steps.map((s) => {
            const Glyph = s.icon;
            return (
              <VStack key={s.n} gap={4} position='relative'>
                <HStack gap={3}>
                  <Center
                    width={44}
                    height={44}
                    radius='xl'
                    border
                    bg='card'
                    shadow='sm'
                  >
                    <Icon icon={Glyph} size='md' color='primary' />
                  </Center>
                  <Text
                    family='mono'
                    size='sm'
                    weight='semibold'
                    color='slate-300'
                  >
                    {s.n}
                  </Text>
                </HStack>
                <VStack gap={1}>
                  <Heading level={3} size='lg'>
                    {s.title}
                  </Heading>
                  <Box maxWidth='20rem'>
                    <Text
                      as='p'
                      size='sm'
                      color='muted-foreground'
                      leading='relaxed'
                    >
                      {s.body}
                    </Text>
                  </Box>
                </VStack>
              </VStack>
            );
          })}
        </Grid>
      </Container>
    </Box>
  );
}

/* ---------------------------------------------------------------- Pricing */
function Pricing() {
  const tiers = [
    {
      name: 'Starter',
      price: '$0',
      unit: '/ mo',
      desc: 'For a single practice getting started.',
      feats: [
        'Up to 5 calendars',
        '1 Calendar Group',
        'Hosted booking page',
        'Community support',
      ],
      cta: 'Start free',
      highlight: false,
    },
    {
      name: 'Growth',
      price: '$249',
      unit: '/ mo',
      desc: 'For growing care teams and clinics.',
      feats: [
        'Up to 50 calendars',
        'Unlimited Calendar Groups',
        'Full booking API + webhooks',
        'HIPAA BAA included',
        'Priority support',
      ],
      cta: 'Book a demo',
      highlight: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      unit: '',
      desc: 'For health systems & networks.',
      feats: [
        'Unlimited everything',
        'SSO & audit logs',
        'SLA & dedicated support',
        'On-prem sync options',
      ],
      cta: 'Talk to sales',
      highlight: false,
    },
  ];
  return (
    <Box as='section' bg='background' py={{ base: 20, md: 24 }}>
      <Container>
        <Box mx='auto' maxWidth='42rem'>
          <VStack gap={4}>
            <Eyebrow align='center'>Pricing</Eyebrow>
            {/* TODO(ds-gap): no Responsive<TextSize> on Heading — see Hero. */}
            <Heading
              level={2}
              size='3xl'
              align='center'
              className='md:text-4xl'
            >
              Simple plans that scale with your calendars.
            </Heading>
          </VStack>
        </Box>
        <Grid columns={{ base: 1, md: 3 }} gap={5} mt={12} align='start'>
          {tiers.map((t) => (
            <Box
              key={t.name}
              position='relative'
              p={6}
              radius='2xl'
              border
              bg='card'
              borderColor={t.highlight ? 'primary' : 'border'}
              shadow={t.highlight ? 'lg' : undefined}
            >
              {t.highlight ? (
                <Box
                  position='absolute'
                  style={{ top: '-0.75rem', left: '1.5rem' }}
                >
                  <Badge>
                    <Text size='xs' weight='semibold' tracking='wide' uppercase>
                      Most popular
                    </Text>
                  </Badge>
                </Box>
              ) : null}
              <VStack gap={1}>
                <Heading level={3} size='lg'>
                  {t.name}
                </Heading>
                <Box height={36}>
                  <Text as='p' size='sm' color='muted-foreground'>
                    {t.desc}
                  </Text>
                </Box>
              </VStack>
              <Flex align='end' gap={1} pt={3}>
                <Text size='4xl' weight='bold' leading='none' tracking='tight'>
                  {t.price}
                </Text>
                <Text size='sm' color='muted-foreground'>
                  {t.unit}
                </Text>
              </Flex>
              <Box pt={6}>
                {/* Button has no width prop (shadcn atom) — `w-full` is the escape. */}
                <Button
                  asChild
                  variant={t.highlight ? 'default' : 'outline'}
                  fullWidth
                >
                  <Link href='/auth/signup'>{t.cta}</Link>
                </Button>
              </Box>
              <Box pt={6}>
                <List variant='plain' gap={3}>
                  {t.feats.map((f) => (
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
              </Box>
            </Box>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

/* ---------------------------------------------------------------- CTA */
function CTA() {
  return (
    <Box as='section' py={{ base: 20, md: 24 }}>
      <Container>
        <Box
          position='relative'
          overflow='hidden'
          radius='2xl'
          bg='vinta-600'
          px={8}
          py={{ base: 12, md: 20 }}
        >
          {/* `grid-bg` is a custom utility (tokens.css) — no token-prop equivalent. */}
          <Box
            position='absolute'
            className='grid-bg'
            style={{ inset: 0, opacity: 0.12 }}
          />
          <VStack gap={4} position='relative'>
            <Box mx='auto' maxWidth='42rem'>
              {/* TODO(ds-gap): no Responsive<TextSize> on Heading — see Hero. */}
              <Heading
                level={2}
                size='3xl'
                align='center'
                color={WHITE}
                className='md:text-5xl'
              >
                Bring your calendars. We&apos;ll handle the booking.
              </Heading>
            </Box>
            <Box mx='auto' maxWidth='36rem'>
              <Text as='p' size='lg' align='center' color={WHITE_85}>
                Start free, or talk to us about your care model. Most teams are
                live the same day.
              </Text>
            </Box>
            <Flex wrap align='center' justify='center' gap={3} pt={4}>
              {/* TODO(ds-gap): Button has no "on primary surface" (inverse)
                  variant, so the white/ghost-on-brand treatments stay classes. */}
              <Button
                asChild
                size='lg'
                className='text-vinta-700 hover:bg-vinta-50 bg-white'
              >
                <Link href='/auth/signup'>
                  Start building
                  <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size='lg'
                variant='outline'
                className='border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white'
              >
                <Link href='#'>Book a demo</Link>
              </Button>
            </Flex>
          </VStack>
        </Box>
      </Container>
    </Box>
  );
}

/* ---------------------------------------------------------------- Footer */
function Footer() {
  const cols = [
    {
      h: 'Product',
      links: [
        'Overview',
        'Calendar Groups',
        'Booking API',
        'Integrations',
        'Pricing',
      ],
    },
    {
      h: 'Developers',
      links: ['API docs', 'SDKs', 'Webhooks', 'Status', 'Changelog'],
    },
    {
      h: 'Company',
      links: ['About', 'Customers', 'Careers', 'Blog', 'Contact'],
    },
    { h: 'Trust', links: ['HIPAA', 'SOC 2', 'Security', 'Privacy', 'Terms'] },
  ];
  const social = [
    { key: 'globe', Glyph: Globe },
    { key: 'mail', Glyph: Mail },
    { key: 'rss', Glyph: Rss },
  ];
  return (
    <Box as='footer' bg='card'>
      <Container>
        {/* TODO(ds-gap): Grid `columns` takes a template string OR a responsive
            object of counts — not a responsive template. The md: track sizing
            has to stay a utility class (columns={{ base: 1 }} keeps the inline
            grid-template-columns off, so the class can win). */}
        <Grid
          columns={{ base: 1 }}
          gap={10}
          py={12}
          className='md:grid-cols-[1.4fr_repeat(4,1fr)]'
        >
          <VStack gap={4}>
            <Image
              src='/vinta-wordmark.svg'
              alt='Vinta Schedule'
              height={18}
              width='auto'
              fit='contain'
              // TODO(ds-gap): Image has no dark-mode inversion prop.
              className='dark:brightness-0 dark:invert'
            />
            <Box maxWidth='15rem'>
              <Text as='p' size='sm' color='muted-foreground' leading='relaxed'>
                Calendar aggregation &amp; booking infrastructure for
                healthcare. Building tech the human way.
              </Text>
            </Box>
            <HStack gap={2} color='muted-foreground'>
              {social.map(({ key, Glyph }) => (
                <Button key={key} asChild variant='outline' size='icon'>
                  <Link href='#'>
                    <Glyph />
                  </Link>
                </Button>
              ))}
            </HStack>
          </VStack>
          {cols.map((c) => (
            <VStack key={c.h} gap={3}>
              <Text
                as='div'
                size='xs'
                weight='semibold'
                tracking='wider'
                uppercase
                color='muted-foreground'
              >
                {c.h}
              </Text>
              <List variant='plain' gap={2}>
                {c.links.map((l) => (
                  <ListItem key={l}>
                    <TextLink
                      href='#'
                      variant='muted'
                      underline='none'
                      size='md'
                    >
                      {l}
                    </TextLink>
                  </ListItem>
                ))}
              </List>
            </VStack>
          ))}
        </Grid>
      </Container>
      <Divider />
      <Container>
        <Flex
          direction={{ base: 'column', sm: 'row' }}
          align='center'
          justify='between'
          gap={3}
          py={5}
        >
          <Text size='xs' color='muted-foreground'>
            © 2026 Vinta Schedule. All rights reserved.
          </Text>
          <HStack gap={2}>
            <Icon icon={ShieldCheck} size='xs' color='success' />
            <Text size='xs' color='muted-foreground'>
              HIPAA-compliant · SOC 2 Type II
            </Text>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}

export function MarketingHome() {
  return (
    <Box bg='card'>
      <MarketingNav />
      <Hero />
      <Divider />
      <LogoCloud />
      <Divider />
      <Features />
      <Divider />
      <ApiShowcase />
      <Divider />
      <HowItWorks />
      <Divider />
      <Pricing />
      <CTA />
      <Divider />
      <Footer />
    </Box>
  );
}
