import Link from 'next/link';
import { CalendarSync, Globe, Mail, Rss } from 'lucide-react';

import { Button } from 'vinta-schedule-design-system/ui/button';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { Image } from 'vinta-schedule-design-system/ui/image';
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import {
  Box,
  Container,
  Divider,
  Flex,
  Grid,
  HStack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';

/**
 * Public marketing footer — shared by the landing page, the `(marketing)`
 * pages, and the docs shell so every public surface ends the same way. No
 * interactivity, so it stays a server component (unlike `MarketingNav`).
 */
export function MarketingFooter() {
  const cols = [
    {
      h: 'Product',
      links: [
        { label: 'Overview', href: '/product' },
        { label: 'Calendar Groups', href: '/product/calendar-groups' },
        { label: 'Booking API', href: '/docs/reference' },
        { label: 'Integrations', href: '/product/integrations' },
        { label: 'Pricing', href: '/pricing' },
      ],
    },
    {
      h: 'Developers',
      links: [
        { label: 'API docs', href: '/docs' },
        { label: 'Webhooks', href: '/docs/webhooks' },
        { label: 'Status', href: 'https://status.schedule.vintasoftware.com/' },
      ],
    },
    {
      h: 'Company',
      links: [
        { label: 'About', href: 'https://www.vintasoftware.com/about-us' },
        { label: 'Careers', href: 'https://www.vintasoftware.com/careers' },
        { label: 'Blog', href: 'https://www.vintasoftware.com/blog' },
        { label: 'Contact', href: 'https://www.vintasoftware.com/contact' },
      ],
    },
    {
      h: 'Trust',
      links: [
        { label: 'Security', href: '/security' },
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
        { label: 'Status', href: 'https://status.schedule.vintasoftware.com/' },
      ],
    },
  ];
  const social = [
    { key: 'globe', Glyph: Globe },
    { key: 'mail', Glyph: Mail },
    { key: 'rss', Glyph: Rss },
  ];
  return (
    <Box as='footer' bg='card'>
      <Container>
        {/* Grid `columns` takes a template string OR a responsive object of
            counts — not a responsive template. The md: track sizing stays a
            utility class (columns={{ base: 1 }} keeps the inline
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
                  <ListItem key={l.label}>
                    <TextLink
                      href={l.href ?? '#'}
                      variant='muted'
                      underline='none'
                      size='md'
                    >
                      {l.label}
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
            <Icon icon={CalendarSync} size='xs' color='primary' />
            <Text size='xs' color='muted-foreground'>
              Two-way sync for every connected calendar
            </Text>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}
