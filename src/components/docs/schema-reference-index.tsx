import Link from 'next/link';

import {
  Box,
  Flex,
  Heading,
  Stack,
  Text,
} from 'vinta-schedule-design-system/layout';
import { Card } from 'vinta-schedule-design-system/ui/card';
import type { GraphQLSchemaModel } from '@/lib/docs/parse-schema';

export interface SchemaReferenceIndexProps {
  model: GraphQLSchemaModel;
}

interface Section {
  href: string;
  title: string;
  count: number;
  noun: string;
  blurb: string;
}

/**
 * `/docs/reference` — the schema reference overview. Rather than dumping every
 * query, mutation, and type on one page, it links to a dedicated page for each
 * so the sections stay browsable. Built from a single build-time introspection
 * snapshot (`getSchemaIntrospection`) shared with those pages.
 */
export function SchemaReferenceIndex({ model }: SchemaReferenceIndexProps) {
  const sections: Section[] = [
    {
      href: '/docs/reference/queries',
      title: 'Queries',
      count: model.queries.length,
      noun: 'queries',
      blurb: 'Read data — bookable slots, calendars, events, and more.',
    },
    {
      href: '/docs/reference/mutations',
      title: 'Mutations',
      count: model.mutations.length,
      noun: 'mutations',
      blurb: 'Write data — create, update, and delete through the API.',
    },
    {
      href: '/docs/reference/types',
      title: 'Types',
      count: model.types.length,
      noun: 'types',
      blurb: 'Every object, input, and enum the operations refer to.',
    },
  ];

  return (
    <Stack gap={8}>
      <Stack gap={2}>
        <Heading level={1}>Schema Reference</Heading>
        <Text color='muted-foreground'>
          Generated from live introspection of{' '}
          <Text as='code' family='mono' size='sm'>
            POST /graphql/
          </Text>{' '}
          — {model.queries.length} queries, {model.mutations.length} mutations,{' '}
          {model.types.length} types.
        </Text>
      </Stack>

      <Flex direction={{ base: 'column', sm: 'row' }} gap={4} wrap>
        {sections.map((section) => (
          <Box key={section.href} grow={1} basis={0} minWidth={220}>
            <Link href={section.href}>
              <Card
                padding={5}
                className='hover:border-primary h-full transition-colors'
              >
                <Stack gap={3}>
                  <Stack gap={1}>
                    <Heading level={2}>{section.title}</Heading>
                    <Text
                      size='xs'
                      weight='medium'
                      color='muted-foreground'
                      uppercase
                      tracking='wide'
                    >
                      {section.count} {section.noun}
                    </Text>
                  </Stack>
                  <Text size='sm' color='muted-foreground'>
                    {section.blurb}
                  </Text>
                </Stack>
              </Card>
            </Link>
          </Box>
        ))}
      </Flex>
    </Stack>
  );
}
