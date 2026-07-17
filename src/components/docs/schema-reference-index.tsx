import Link from 'next/link';

import { Box, Heading, Stack, Text } from 'vinta-schedule-design-system/layout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'vinta-schedule-design-system/ui/table';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import type { GraphQLSchemaModel } from '@/lib/docs/parse-schema';
import { SchemaFieldList } from './schema-field-list';

const KIND_LABEL: Record<string, string> = {
  OBJECT: 'Object',
  INPUT_OBJECT: 'Input',
  ENUM: 'Enum',
};

export interface SchemaReferenceIndexProps {
  model: GraphQLSchemaModel;
}

/**
 * `/docs/reference` — the schema reference index. Lists every query and
 * mutation with full detail (args, return type, description) inline, plus a
 * browsable table of every documented type. Fetched from a single build-time
 * introspection snapshot (`getSchemaIntrospection`) shared with the per-type
 * detail pages.
 */
export function SchemaReferenceIndex({ model }: SchemaReferenceIndexProps) {
  const documentedTypeNames = new Set(model.types.map((t) => t.name));

  return (
    <Stack gap={10}>
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

      <Box as='section' id='queries'>
        <Stack gap={4}>
          <Heading level={2}>Queries</Heading>
          <SchemaFieldList
            fields={model.queries}
            documentedTypeNames={documentedTypeNames}
            emptyLabel='This schema has no queries.'
          />
        </Stack>
      </Box>

      <Box as='section' id='mutations'>
        <Stack gap={4}>
          <Heading level={2}>Mutations</Heading>
          <SchemaFieldList
            fields={model.mutations}
            documentedTypeNames={documentedTypeNames}
            emptyLabel='This schema has no mutations.'
          />
        </Stack>
      </Box>

      <Box as='section' id='types'>
        <Stack gap={4}>
          <Heading level={2}>Types</Heading>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.types.map((type) => (
                <TableRow key={type.name}>
                  <TableCell>
                    <TextLink asChild size='sm'>
                      <Link href={`/docs/reference/types/${type.slug}`}>
                        <Text as='code' family='mono' size='sm'>
                          {type.name}
                        </Text>
                      </Link>
                    </TextLink>
                  </TableCell>
                  <TableCell>
                    <Badge variant='secondary'>{KIND_LABEL[type.kind]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Text size='sm' color='muted-foreground'>
                      {type.description ?? '—'}
                    </Text>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      </Box>

      {model.scalars.length > 0 ? (
        <Box as='section' id='scalars'>
          <Stack gap={4}>
            <Heading level={2}>Custom Scalars</Heading>
            <Stack gap={2}>
              {model.scalars.map((scalar) => (
                <Text key={scalar.name} size='sm'>
                  <Text as='code' family='mono' weight='medium'>
                    {scalar.name}
                  </Text>
                  {scalar.description ? (
                    <Text as='span' color='muted-foreground'>
                      {' '}
                      — {scalar.description}
                    </Text>
                  ) : null}
                </Text>
              ))}
            </Stack>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
