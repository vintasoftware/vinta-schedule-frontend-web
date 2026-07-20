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

const KIND_LABEL: Record<string, string> = {
  OBJECT: 'Object',
  INPUT_OBJECT: 'Input',
  ENUM: 'Enum',
};

export interface SchemaTypesViewProps {
  model: GraphQLSchemaModel;
}

/**
 * `/docs/reference/types` — the browsable table of every documented object,
 * input, and enum type, plus the schema's custom scalars. Each row links to
 * that type's detail page.
 */
export function SchemaTypesView({ model }: SchemaTypesViewProps) {
  return (
    <Stack gap={8}>
      <Stack gap={2}>
        <TextLink asChild size='sm'>
          <Link href='/docs/reference'>← Schema Reference</Link>
        </TextLink>
        <Heading level={1}>Types</Heading>
        <Text color='muted-foreground'>
          Every object, input, and enum in the public schema —{' '}
          {model.types.length} in all. Open any type to see its fields and how
          they connect.
        </Text>
      </Stack>

      <Box as='section'>
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
      </Box>

      {model.scalars.length > 0 ? (
        <Box as='section'>
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
