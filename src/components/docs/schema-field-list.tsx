import Link from 'next/link';

import { Box, Flex, Stack, Text } from 'vinta-schedule-design-system/layout';
import { Card } from 'vinta-schedule-design-system/ui/card';
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import type { GraphQLSchemaField } from '@/lib/docs/parse-schema';
import {
  describeOperation,
  type OperationType,
} from '@/lib/docs/build-operation-example';

/** Self-contained styling for an injected, pre-highlighted example code block. */
const EXAMPLE_CODE_CLASSNAME =
  '[&_pre]:bg-muted [&_pre]:border-border [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:p-3 [&_pre]:text-sm [&_pre]:leading-relaxed';

export interface SchemaFieldListProps {
  fields: GraphQLSchemaField[];
  /** Type names with a `/docs/reference/types/<name>` detail page — used to decide whether a field's return/arg type renders as a link. */
  documentedTypeNames: Set<string>;
  emptyLabel?: string;
  /**
   * Marks these fields as top-level operations. When set, every card shows a
   * description (the schema's own, or a humanized fallback so none is blank)
   * and, when `examples` carries one, a ready-to-run example.
   */
  operationType?: OperationType;
  /** fieldName → pre-highlighted, already-sanitized example HTML. */
  examples?: Map<string, string>;
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
 * description, arguments, and, for operations, an example request.
 */
export function SchemaFieldList({
  fields,
  documentedTypeNames,
  emptyLabel = 'None.',
  operationType,
  examples,
}: SchemaFieldListProps) {
  if (fields.length === 0) {
    return (
      <Text size='sm' color='muted-foreground'>
        {emptyLabel}
      </Text>
    );
  }

  return (
    <Stack gap={4}>
      {fields.map((field) => {
        const description = operationType
          ? describeOperation(field, operationType)
          : field.description;
        const example = examples?.get(field.name);

        return (
          <Card key={field.name} padding={5}>
            <Stack gap={3}>
              <Flex justify='between' align='baseline' gap={4} wrap>
                <Text as='code' family='mono' weight='semibold' size='base'>
                  {field.name}
                </Text>
                <Flex align='baseline' gap={1}>
                  <Text as='span' size='sm' color='muted-foreground'>
                    →
                  </Text>
                  <FieldTypeLabel
                    type={field.type}
                    typeName={field.typeName}
                    documentedTypeNames={documentedTypeNames}
                  />
                </Flex>
              </Flex>

              {description ? (
                <Text size='sm' color='muted-foreground'>
                  {description}
                </Text>
              ) : null}

              {field.isDeprecated ? (
                <Text size='xs' color='warning'>
                  Deprecated
                  {field.deprecationReason
                    ? `: ${field.deprecationReason}`
                    : '.'}
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
                          {arg.defaultValue !== null ? (
                            <Text
                              as='code'
                              family='mono'
                              size='sm'
                              color='muted-foreground'
                            >
                              = {arg.defaultValue}
                            </Text>
                          ) : null}
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

              {example ? (
                <Stack gap={1} pt={1}>
                  <Text
                    size='xs'
                    weight='medium'
                    color='muted-foreground'
                    uppercase
                  >
                    Example
                  </Text>
                  <Box
                    className={EXAMPLE_CODE_CLASSNAME}
                    dangerouslySetInnerHTML={{ __html: example }}
                  />
                </Stack>
              ) : null}
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
