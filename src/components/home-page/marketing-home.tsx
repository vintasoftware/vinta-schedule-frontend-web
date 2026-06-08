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

import { cn } from '@/lib/utils/index';
import { Button } from '@/components/ui/button';
import { Box, Container, Text } from '@/components/layout';
import { Navbar, BrandMark } from '@/components/layout/navbar';
import { ThemeToggle } from '@/components/navigation/theme-toggle';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Text
      as='span'
      className='bg-vinta-50 text-primary inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12.5px] font-semibold tracking-[0.06em] uppercase'
    >
      {children}
    </Text>
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
    setIsAuthenticated(Boolean(localStorage.getItem('accessToken')));
  }, []);

  return (
    <Navbar
      brand={
        <Link href='/'>
          <BrandMark />
        </Link>
      }
      links={links.map((l) => (
        <a
          key={l}
          href='#'
          className='text-muted-foreground hover:text-foreground text-sm font-medium transition-colors'
        >
          {l}
        </a>
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
              <Button
                asChild
                variant='ghost'
                size='sm'
                className='hidden sm:inline-flex'
              >
                <Link href='/auth/login'>Sign in</Link>
              </Button>
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
    <Box
      as='section'
      className='border-border relative overflow-hidden border-b'
    >
      <Box
        className='grid-bg absolute inset-0 opacity-60'
        style={{
          maskImage:
            'radial-gradient(120% 80% at 50% 0%, black, transparent 70%)',
        }}
      />
      <Container className='relative grid items-center gap-14 pt-20 pb-16 md:pt-28 md:pb-24 lg:grid-cols-2'>
        <Box>
          <Eyebrow>
            <Box as='span' className='bg-primary size-1.5 rounded-full' />
            Calendar infrastructure for healthcare
          </Eyebrow>
          <Text
            as='h1'
            className='mt-5 block text-[40px] leading-[1.05] font-bold tracking-[-0.02em] text-balance md:text-[56px]'
          >
            Every calendar in your organization,{' '}
            <Text as='span' color='primary'>
              bookable through one API.
            </Text>
          </Text>
          <Text
            as='p'
            className='text-muted-foreground mt-5 block max-w-xl text-[18px] leading-relaxed'
          >
            Vinta Schedule aggregates personal, resource, and virtual calendars,
            then lets your patients find and book the right provider or room —
            in seconds, in sync, HIPAA-ready.
          </Text>
          <Box className='mt-8 flex flex-wrap items-center gap-3'>
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
          </Box>
          <Text
            as='p'
            className='text-muted-foreground mt-6 flex items-center gap-2 text-[13px]'
          >
            <ShieldCheck className='text-success size-[15px]' />
            HIPAA-compliant · SOC 2 Type II · 99.99% sync uptime
          </Text>
        </Box>
        <HeroMock />
      </Container>
    </Box>
  );
}

function HeroMock() {
  const slots = ['9:00', '9:30', '10:30', '11:00', '1:30', '2:00'];
  const [sel, setSel] = React.useState('10:30');
  const days = ['Mon 15', 'Tue 16', 'Wed 17', 'Thu 18'];
  return (
    <Box className='relative'>
      <Box className='bg-vinta-50 absolute -inset-4 -rotate-1 rounded-[28px]' />
      <Box className='border-border bg-card relative overflow-hidden rounded-2xl border shadow-xl'>
        <Box className='border-border flex items-center gap-2.5 border-b px-5 pt-4 pb-3'>
          <Box
            as='span'
            className='bg-vinta-600 flex size-8 items-center justify-center rounded-lg text-[13px] font-bold text-white'
          >
            Q
          </Box>
          <Box>
            <Box className='text-[13px] leading-tight font-semibold'>
              Quilted Health
            </Box>
            <Box className='text-muted-foreground text-[11.5px] leading-tight'>
              Prenatal Intake · 30 min
            </Box>
          </Box>
          <Box
            as='span'
            className='ml-auto inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-2.5 py-1 text-[11.5px] font-medium text-teal-700'
          >
            <Box as='span' className='size-1.5 rounded-full bg-teal-600' />
            Live availability
          </Box>
        </Box>
        <Box className='p-5'>
          <Box className='mb-3 flex items-center gap-2'>
            {days.map((d, i) => (
              <Box
                key={d}
                className={cn(
                  'flex-1 rounded-lg border py-2 text-center text-[12px] font-medium',
                  i === 2
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground'
                )}
              >
                <Box className='opacity-80'>{d.split(' ')[0]}</Box>
                <Box className='text-[14px] font-semibold'>
                  {d.split(' ')[1]}
                </Box>
              </Box>
            ))}
          </Box>
          <Box className='text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase'>
            Wed, Jun 17 · PT
          </Box>
          <Box className='grid grid-cols-3 gap-2'>
            {slots.map((s) => (
              <button
                key={s}
                type='button'
                onClick={() => setSel(s)}
                className={cn(
                  'h-10 rounded-lg border font-mono text-[13px] font-medium transition',
                  sel === s
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary hover:text-primary'
                )}
              >
                {s}
              </button>
            ))}
          </Box>
          <button
            type='button'
            className='bg-primary text-primary-foreground hover:bg-primary/90 mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-medium transition'
          >
            Confirm {sel} AM
            <ArrowRight className='size-4' />
          </button>
        </Box>
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
    <Box as='section' className='border-border bg-background border-b py-12'>
      <Container>
        <Text
          as='p'
          className='text-muted-foreground mb-7 block text-center text-[13px] font-medium'
        >
          Scheduling for modern care teams
        </Text>
        <Box className='flex flex-wrap items-center justify-center gap-x-12 gap-y-5'>
          {names.map((n) => (
            <Text
              key={n}
              as='span'
              className='text-[17px] font-semibold tracking-tight text-slate-400'
            >
              {n}
            </Text>
          ))}
        </Box>
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
    <Box as='section' className='py-20 md:py-28'>
      <Container>
        <Box className='max-w-2xl'>
          <Eyebrow>Why Vinta Schedule</Eyebrow>
          <Text
            as='h2'
            className='mt-4 block text-[32px] leading-tight font-bold tracking-[-0.02em] md:text-[40px]'
          >
            Scheduling infrastructure, not another calendar app.
          </Text>
          <Text
            as='p'
            className='text-muted-foreground mt-4 block text-[17px] leading-relaxed'
          >
            You bring the calendars and the care model. We handle aggregation,
            availability, and booking — so your team can build the experience
            patients actually want.
          </Text>
        </Box>
        <Box className='mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4'>
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <Box
                key={it.title}
                className='border-border bg-card rounded-2xl border p-6 transition-shadow hover:shadow-md'
              >
                <Box
                  as='span'
                  className='bg-vinta-50 text-primary flex size-11 items-center justify-center rounded-xl'
                >
                  <Icon className='size-[22px]' />
                </Box>
                <Text as='h3' className='mt-4 block text-[16px] font-semibold'>
                  {it.title}
                </Text>
                <Text
                  as='p'
                  className='text-muted-foreground mt-1.5 block text-[13.5px] leading-relaxed'
                >
                  {it.body}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
}

/* ---------------------------------------------------------------- API showcase */
function ApiShowcase() {
  return (
    <Box
      as='section'
      className='border-border bg-background border-y py-20 md:py-24'
    >
      <Container className='grid items-center gap-12 lg:grid-cols-2'>
        <Box>
          <Eyebrow>For developers</Eyebrow>
          <Text
            as='h2'
            className='mt-4 block text-[30px] leading-tight font-bold tracking-[-0.02em] md:text-[38px]'
          >
            Book a slot in one call.
          </Text>
          <Text
            as='p'
            className='text-muted-foreground mt-4 block max-w-lg text-[16.5px] leading-relaxed'
          >
            Query a Calendar Group for live availability, then confirm — Vinta
            resolves the right provider or resource and writes back to every
            connected calendar.
          </Text>
          <Box as='ul' className='mt-6 flex flex-col gap-3'>
            {[
              'REST + webhooks for every booking event',
              'Idempotent holds so slots never double-book',
              'Typed SDKs for Python, Node & Go',
            ].map((t) => (
              <Box
                as='li'
                key={t}
                className='flex items-center gap-3 text-[14.5px]'
              >
                <Check className='text-success size-4' />
                {t}
              </Box>
            ))}
          </Box>
          <Box className='mt-7'>
            <Button variant='outline'>
              <BookOpen />
              Read the API docs
            </Button>
          </Box>
        </Box>
        <Box className='overflow-hidden rounded-2xl border border-slate-800 shadow-xl'>
          <Box className='flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2.5'>
            <Box as='span' className='size-3 rounded-full bg-slate-700' />
            <Box as='span' className='size-3 rounded-full bg-slate-700' />
            <Box as='span' className='size-3 rounded-full bg-slate-700' />
            <Text
              as='span'
              family='mono'
              className='ml-2 text-[12px] text-slate-400'
            >
              booking.sh
            </Text>
          </Box>
          <Box
            as='pre'
            className='overflow-x-auto bg-slate-950 p-5 font-mono text-[13px] leading-[1.7] text-slate-100'
          >
            <Text as='span' className='text-slate-500'>
              # Find availability in a Calendar Group
            </Text>
            {'\n'}
            <Text as='span' className='text-teal-300'>
              curl
            </Text>{' '}
            https://api.vinta.dev/v1/groups/
            <Text as='span' className='text-vinta-300'>
              grp_8fk2
            </Text>
            /availability \{'\n'}
            {'  '}-d type=
            <Text as='span' className='text-teal-300'>
              &quot;intake-30&quot;
            </Text>{' '}
            -d date=
            <Text as='span' className='text-teal-300'>
              &quot;2026-06-17&quot;
            </Text>
            {'\n\n'}
            <Text as='span' className='text-slate-500'>
              # → confirm the slot
            </Text>
            {'\n'}
            <Text as='span' className='text-teal-300'>
              POST
            </Text>{' '}
            /v1/groups/grp_8fk2/bookings
            {'\n'}
            {'{ '}
            <Text as='span' className='text-vinta-300'>
              &quot;start&quot;
            </Text>
            :{' '}
            <Text as='span' className='text-teal-300'>
              &quot;2026-06-17T10:30-07:00&quot;
            </Text>
            ,{'\n'}
            {'  '}
            <Text as='span' className='text-vinta-300'>
              &quot;patient&quot;
            </Text>
            :{' '}
            <Text as='span' className='text-teal-300'>
              &quot;pat_1a2b&quot;
            </Text>{' '}
            {'}'}
            {'\n\n'}
            <Text as='span' className='text-slate-500'>
              # ← 201 booked · synced to 3 calendars
            </Text>
          </Box>
        </Box>
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
    <Box as='section' className='py-20 md:py-28'>
      <Container>
        <Box className='mx-auto max-w-2xl text-center'>
          <Eyebrow>How it works</Eyebrow>
          <Text
            as='h2'
            className='mt-4 block text-[32px] font-bold tracking-[-0.02em] md:text-[40px]'
          >
            Live in an afternoon.
          </Text>
        </Box>
        <Box className='mt-14 grid gap-6 md:grid-cols-3'>
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <Box key={s.n} className='relative'>
                <Box className='flex items-center gap-3'>
                  <Box
                    as='span'
                    className='border-border bg-card text-primary flex size-11 items-center justify-center rounded-xl border shadow-sm'
                  >
                    <Icon className='size-[22px]' />
                  </Box>
                  <Text
                    as='span'
                    family='mono'
                    className='text-[13px] font-semibold text-slate-300'
                  >
                    {s.n}
                  </Text>
                </Box>
                <Text as='h3' className='mt-4 block text-[18px] font-semibold'>
                  {s.title}
                </Text>
                <Text
                  as='p'
                  className='text-muted-foreground mt-1.5 block max-w-xs text-[14.5px] leading-relaxed'
                >
                  {s.body}
                </Text>
              </Box>
            );
          })}
        </Box>
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
    <Box
      as='section'
      className='border-border bg-background border-t py-20 md:py-28'
    >
      <Container>
        <Box className='mx-auto max-w-2xl text-center'>
          <Eyebrow>Pricing</Eyebrow>
          <Text
            as='h2'
            className='mt-4 block text-[32px] font-bold tracking-[-0.02em] md:text-[40px]'
          >
            Simple plans that scale with your calendars.
          </Text>
        </Box>
        <Box className='mt-14 grid items-start gap-5 md:grid-cols-3'>
          {tiers.map((t) => (
            <Box
              key={t.name}
              className={cn(
                'rounded-2xl border p-7',
                t.highlight
                  ? 'border-primary bg-card ring-primary relative shadow-lg ring-1'
                  : 'border-border bg-card'
              )}
            >
              {t.highlight ? (
                <Text
                  as='span'
                  className='bg-primary text-primary-foreground absolute -top-3 left-7 rounded-full px-3 py-1 text-[11.5px] font-semibold tracking-wide uppercase'
                >
                  Most popular
                </Text>
              ) : null}
              <Text as='h3' className='block text-[17px] font-semibold'>
                {t.name}
              </Text>
              <Text
                as='p'
                className='text-muted-foreground mt-1 block h-9 text-[13.5px]'
              >
                {t.desc}
              </Text>
              <Box className='mt-3 flex items-end gap-1'>
                <Text
                  as='span'
                  className='text-[40px] leading-none font-bold tracking-tight'
                >
                  {t.price}
                </Text>
                <Text
                  as='span'
                  className='text-muted-foreground mb-1 text-[14px]'
                >
                  {t.unit}
                </Text>
              </Box>
              <Box className='mt-6'>
                <Button
                  asChild
                  variant={t.highlight ? 'default' : 'outline'}
                  className='w-full'
                >
                  <Link href='/auth/signup'>{t.cta}</Link>
                </Button>
              </Box>
              <Box as='ul' className='mt-6 flex flex-col gap-3'>
                {t.feats.map((f) => (
                  <Box
                    as='li'
                    key={f}
                    className='flex items-start gap-2.5 text-[14px]'
                  >
                    <Check className='text-success mt-0.5 size-4' />
                    {f}
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

/* ---------------------------------------------------------------- CTA */
function CTA() {
  return (
    <Box as='section' className='py-20 md:py-24'>
      <Container>
        <Box className='bg-vinta-600 relative overflow-hidden rounded-3xl px-8 py-14 text-center md:py-20'>
          <Box className='grid-bg absolute inset-0 opacity-[0.12]' />
          <Box className='relative'>
            <Text
              as='h2'
              className='mx-auto block max-w-2xl text-[32px] leading-[1.1] font-bold tracking-[-0.02em] text-white md:text-[44px]'
            >
              Bring your calendars. We&apos;ll handle the booking.
            </Text>
            <Text
              as='p'
              className='mx-auto mt-4 block max-w-xl text-[17px] text-white/85'
            >
              Start free, or talk to us about your care model. Most teams are
              live the same day.
            </Text>
            <Box className='mt-8 flex flex-wrap items-center justify-center gap-3'>
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
              <a
                href='#'
                className='inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/30 px-6 text-base font-medium text-white transition hover:bg-white/10'
              >
                Book a demo
              </a>
            </Box>
          </Box>
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
    { key: 'globe', Icon: Globe },
    { key: 'mail', Icon: Mail },
    { key: 'rss', Icon: Rss },
  ];
  return (
    <Box as='footer' className='border-border bg-card border-t'>
      <Container className='grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(4,1fr)]'>
        <Box>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src='/vinta-wordmark.svg'
            alt='Vinta Schedule'
            className='h-[18px] w-auto dark:brightness-0 dark:invert'
          />
          <Text
            as='p'
            className='text-muted-foreground mt-4 block max-w-[15rem] text-[13.5px] leading-relaxed'
          >
            Calendar aggregation &amp; booking infrastructure for healthcare.
            Building tech the human way.
          </Text>
          <Box className='text-muted-foreground mt-4 flex items-center gap-2.5'>
            {social.map(({ key, Icon }) => (
              <a
                key={key}
                href='#'
                className='border-border hover:text-foreground flex size-9 items-center justify-center rounded-lg border transition hover:border-slate-300'
              >
                <Icon className='size-4' />
              </a>
            ))}
          </Box>
        </Box>
        {cols.map((c) => (
          <Box key={c.h}>
            <Text
              as='div'
              className='text-muted-foreground mb-3 text-[12px] font-semibold tracking-[0.06em] uppercase'
            >
              {c.h}
            </Text>
            <Box as='ul' className='flex flex-col gap-2.5'>
              {c.links.map((l) => (
                <Box as='li' key={l}>
                  <a
                    href='#'
                    className='text-foreground/80 hover:text-primary text-[13.5px] transition-colors'
                  >
                    {l}
                  </a>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Container>
      <Box className='border-border border-t'>
        <Container className='text-muted-foreground flex flex-col items-center justify-between gap-3 py-5 text-[12.5px] sm:flex-row'>
          <Text as='span'>© 2026 Vinta Schedule. All rights reserved.</Text>
          <Text as='span' className='inline-flex items-center gap-2'>
            <ShieldCheck className='text-success size-[14px]' />
            HIPAA-compliant · SOC 2 Type II
          </Text>
        </Container>
      </Box>
    </Box>
  );
}

export function MarketingHome() {
  return (
    <Box className='bg-card'>
      <MarketingNav />
      <Hero />
      <LogoCloud />
      <Features />
      <ApiShowcase />
      <HowItWorks />
      <Pricing />
      <CTA />
      <Footer />
    </Box>
  );
}
