import Link from 'next/link';

import { Flex, Stack, Text } from 'vinta-schedule-design-system/layout';
import { Card } from 'vinta-schedule-design-system/ui/card';
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import type { GraphQLSchemaField } from '@/lib/docs/parse-schema';

export interface SchemaFieldListProps {
  fields: GraphQLSchemaField[];
  /** Type names with a `/docs/reference/types/<name>` detail page — used to decide whether a field's return/arg type renders as a link. */
  documentedTypeNames: Set<string>;
  emptyLabel?: string;
}

function FieldTypeLabel({
  type,
  typeName,
  documentedTypeNames,
}: {
  type: string;
  typeName: string | null;
  documentedTypeNames: Set<string>;
}) {
  if (typeName && documentedTypeNames.has(typeName)) {
    return (
      <TextLink asChild size='sm' variant='inherit'>
        <Link href={`/docs/reference/types/${typeName}`}>
          <Text as='code' family='mono' size='sm'>
            {type}
          </Text>
        </Link>
      </TextLink>
    );
  }

  return (
    <Text as='code' family='mono' size='sm' color='muted-foreground'>
      {type}
    </Text>
  );
}

/**
 * Renders a list of GraphQL fields (queries, mutations, object fields, or
 * input fields all share the same normalized `GraphQLSchemaField` shape) —
 * name, return/value type (linked when it resolves to a documented type),
 * description, and any arguments.
 */
export function SchemaFieldList({
  fields,
  documentedTypeNames,
  emptyLabel = 'None.',
}: SchemaFieldListProps) {
  if (fields.length === 0) {
    return (
      <Text size='sm' color='muted-foreground'>
        {emptyLabel}
      </Text>
    );
  }

  return (
    <Stack gap={3}>
      {fields.map((field) => (
        <Card key={field.name} padding={4}>
          <Stack gap={2}>
            <Flex justify='between' align='start' gap={4} wrap>
              <Text as='code' family='mono' weight='semibold' size='sm'>
                {field.name}
              </Text>
              <FieldTypeLabel
                type={field.type}
                typeName={field.typeName}
                documentedTypeNames={documentedTypeNames}
              />
            </Flex>

            {field.description ? (
              <Text size='sm' color='muted-foreground'>
                {field.description}
              </Text>
            ) : null}

            {field.isDeprecated ? (
              <Text size='xs' color='warning'>
                Deprecated
                {field.deprecationReason ? `: ${field.deprecationReason}` : '.'}
              </Text>
            ) : null}

            {field.args.length > 0 ? (
              <Stack gap={1} pt={1}>
                <Text
                  size='xs'
                  weight='medium'
                  color='muted-foreground'
                  uppercase
                >
                  Arguments
                </Text>
                <List variant='plain' gap={1}>
                  {field.args.map((arg) => (
                    <ListItem key={arg.name}>
                      <Flex gap={2} wrap align='baseline'>
                        <Text as='code' family='mono' size='sm'>
                          {arg.name}:
                        </Text>
                        <FieldTypeLabel
                          type={arg.type}
                          typeName={arg.typeName}
                          documentedTypeNames={documentedTypeNames}
                        />
                        {arg.description ? (
                          <Text size='xs' color='muted-foreground'>
                            {arg.description}
                          </Text>
                        ) : null}
                      </Flex>
                    </ListItem>
                  ))}
                </List>
              </Stack>
            ) : null}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
