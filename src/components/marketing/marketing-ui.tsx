import type * as React from 'react';
import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';

import { Badge, BadgeDot } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import {
  Box,
  Center,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  type BoxProps,
} from 'vinta-schedule-design-system/layout';
import type { ColorToken, Space } from 'vinta-schedule-design-system/layout';

/** White — not a design token; passed through as a raw CSS color. */
const WHITE = '#fff';
const WHITE_85 = 'rgb(255 255 255 / 0.85)';

/**
 * Shared building blocks for the public `(marketing)` pages, factored out of the
 * landing page so every page speaks the same visual language: the pill
 * "eyebrow", the section band + intro, and the feature card.
 */

/** Small pill label that sits above a section heading. */
export function Eyebrow({
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

/**
 * A vertical page band with the marketing rhythm (py 20/24) and a centered
 * Container. Pass `bg` to alternate surfaces between sections.
 */
export function MarketingSection({
  children,
  bg,
  py = { base: 20, md: 24 },
  containerProps,
}: {
  children: React.ReactNode;
  bg?: ColorToken;
  py?: BoxProps['py'];
  containerProps?: React.ComponentProps<typeof Container>;
}) {
  return (
    <Box as='section' bg={bg} py={py}>
      <Container {...containerProps}>{children}</Container>
    </Box>
  );
}

/**
 * Eyebrow + heading + optional lead paragraph — the standard header that opens
 * a section. `align='center'` centers it in a readable measure.
 */
export function SectionIntro({
  eyebrow,
  title,
  lead,
  align = 'start',
  maxWidth = '42rem',
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'start' | 'center';
  maxWidth?: string;
}) {
  const centered = align === 'center';
  return (
    <Box mx={centered ? 'auto' : undefined} maxWidth={maxWidth}>
      <VStack gap={4}>
        {eyebrow ? <Eyebrow align={align}>{eyebrow}</Eyebrow> : null}
        {/* Heading `size` is not Responsive<TextSize>, so the md: step of the
            type ramp stays a utility class — matches the landing page. */}
        <Heading
          level={2}
          size='3xl'
          align={centered ? 'center' : undefined}
          className='md:text-4xl'
        >
          {title}
        </Heading>
        {lead ? (
          <Text
            as='p'
            size='lg'
            align={centered ? 'center' : undefined}
            color='muted-foreground'
            leading='relaxed'
          >
            {lead}
          </Text>
        ) : null}
      </VStack>
    </Box>
  );
}

/** Icon-topped card used in feature grids. */
export function FeatureCard({
  icon,
  title,
  children,
  iconBg = 'vinta-50',
  iconColor = 'primary',
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  children: React.ReactNode;
  iconBg?: ColorToken;
  iconColor?: ColorToken;
}) {
  return (
    <Box
      p={6}
      radius='2xl'
      border
      bg='card'
      // Hover elevation is a state, not expressible as a token prop.
      className='h-full transition-shadow hover:shadow-md'
    >
      <VStack gap={4}>
        <Center width={44} height={44} radius='xl' bg={iconBg}>
          <Icon icon={icon} size='md' color={iconColor} />
        </Center>
        <VStack gap={1}>
          <Heading level={3} size='base'>
            {title}
          </Heading>
          <Text as='p' size='sm' color='muted-foreground' leading='relaxed'>
            {children}
          </Text>
        </VStack>
      </VStack>
    </Box>
  );
}

/**
 * Centered page hero with the subtle grid backdrop, shared by the marketing
 * sub-pages. `title` accepts nodes so a page can color-accent part of it.
 */
export function PageHero({
  eyebrow,
  title,
  lead,
  primary,
  secondary,
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  lead: React.ReactNode;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string; icon?: LucideIcon };
}) {
  return (
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
      <Container
        position='relative'
        pt={{ base: 20, md: 24 }}
        pb={{ base: 16, md: 20 }}
      >
        <Box mx='auto' maxWidth='48rem'>
          <VStack gap={5} align='center'>
            <Eyebrow dot align='center'>
              {eyebrow}
            </Eyebrow>
            {/* Heading size is not Responsive<TextSize> — md: step stays a class. */}
            <Heading
              level={1}
              size='4xl'
              align='center'
              className='text-balance md:text-5xl'
            >
              {title}
            </Heading>
            <Box maxWidth='38rem'>
              <Text
                as='p'
                size='lg'
                align='center'
                color='muted-foreground'
                leading='relaxed'
              >
                {lead}
              </Text>
            </Box>
            {primary || secondary ? (
              <Flex wrap align='center' justify='center' gap={3} pt={2}>
                {primary ? (
                  <Button asChild size='lg'>
                    <Link href={primary.href}>
                      {primary.label}
                      <ArrowRight />
                    </Link>
                  </Button>
                ) : null}
                {secondary ? (
                  <Button asChild variant='outline' size='lg'>
                    <Link href={secondary.href}>
                      {secondary.icon ? (
                        <Icon icon={secondary.icon} size='sm' />
                      ) : null}
                      {secondary.label}
                    </Link>
                  </Button>
                ) : null}
              </Flex>
            ) : null}
          </VStack>
        </Box>
      </Container>
    </Box>
  );
}

/**
 * The brand-colored closing call-to-action band, shared by every marketing
 * page so they all end the same way. `primary` is the filled white button;
 * `secondary` is the outlined ghost-on-brand button.
 */
export function CtaBand({
  title,
  lead,
  primary,
  secondary,
}: {
  title: React.ReactNode;
  lead?: React.ReactNode;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
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
              {/* Heading `size` is not Responsive<TextSize> — md: step stays a class. */}
              <Heading
                level={2}
                size='3xl'
                align='center'
                color={WHITE}
                className='md:text-5xl'
              >
                {title}
              </Heading>
            </Box>
            {lead ? (
              <Box mx='auto' maxWidth='36rem'>
                <Text as='p' size='lg' align='center' color={WHITE_85}>
                  {lead}
                </Text>
              </Box>
            ) : null}
            <Flex wrap align='center' justify='center' gap={3} pt={4}>
              {/* Button has no "on primary surface" variant, so the white /
                  ghost-on-brand treatments stay utility classes. */}
              <Button
                asChild
                size='lg'
                className='text-vinta-700 hover:bg-vinta-50 bg-white'
              >
                <Link href={primary.href}>
                  {primary.label}
                  <ArrowRight />
                </Link>
              </Button>
              {secondary ? (
                <Button
                  asChild
                  size='lg'
                  variant='outline'
                  className='border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white'
                >
                  <Link href={secondary.href}>{secondary.label}</Link>
                </Button>
              ) : null}
            </Flex>
          </VStack>
        </Box>
      </Container>
    </Box>
  );
}

/** Shared spacing scale re-export so pages can type section gaps consistently. */
export type { Space };
