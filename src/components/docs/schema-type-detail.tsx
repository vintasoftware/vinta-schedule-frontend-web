import Link from 'next/link';

import {
  Flex,
  Heading,
  Stack,
  Text,
} from 'vinta-schedule-design-system/layout';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import type { GraphQLSchemaType } from '@/lib/docs/parse-schema';
import { SchemaFieldList } from './schema-field-list';

const KIND_LABEL: Record<GraphQLSchemaType['kind'], string> = {
  OBJECT: 'Object',
  INPUT_OBJECT: 'Input',
  ENUM: 'Enum',
};

export interface SchemaTypeDetailProps {
  type: GraphQLSchemaType;
  documentedTypeNames: Set<string>;
}

/**
 * `/docs/reference/types/<name>` — a single type's detail view: fields (for
 * OBJECT), input fields (for INPUT_OBJECT), or enum values (for ENUM), each
 * with description and, for fields, arguments.
 */
export function SchemaTypeDetail({
  type,
  documentedTypeNames,
}: SchemaTypeDetailProps) {
  return (
    <Stack gap={6}>
      <TextLink asChild size='sm'>
        <Link href='/docs/reference#types'>← Back to Schema Reference</Link>
      </TextLink>

      <Stack gap={2}>
        <Flex align='center' gap={3} wrap>
          <Heading level={1} family='mono'>
            {type.name}
          </Heading>
          <Badge variant='secondary'>{KIND_LABEL[type.kind]}</Badge>
        </Flex>
        {type.description ? (
          <Text color='muted-foreground'>{type.description}</Text>
        ) : null}
      </Stack>

      {type.kind === 'OBJECT' ? (
        <Stack gap={4}>
          <Heading level={2}>Fields</Heading>
          <SchemaFieldList
            fields={type.fields}
            documentedTypeNames={documentedTypeNames}
            emptyLabel='This type has no fields.'
          />
        </Stack>
      ) : null}

      {type.kind === 'INPUT_OBJECT' ? (
        <Stack gap={4}>
          <Heading level={2}>Input Fields</Heading>
          <SchemaFieldList
            fields={type.inputFields}
            documentedTypeNames={documentedTypeNames}
            emptyLabel='This input has no fields.'
          />
        </Stack>
      ) : null}

      {type.kind === 'ENUM' ? (
        <Stack gap={4}>
          <Heading level={2}>Values</Heading>
          {type.enumValues.length === 0 ? (
            <Text size='sm' color='muted-foreground'>
              This enum has no values.
            </Text>
          ) : (
            <List variant='plain' gap={2}>
              {type.enumValues.map((value) => (
                <ListItem key={value.name}>
                  <Text as='code' family='mono' weight='medium' size='sm'>
                    {value.name}
                  </Text>
                  {value.description ? (
                    <Text size='sm' color='muted-foreground'>
                      {' '}
                      — {value.description}
                    </Text>
                  ) : null}
                  {value.isDeprecated ? (
                    <Text size='xs' color='warning'>
                      {' '}
                      (deprecated
                      {value.deprecationReason
                        ? `: ${value.deprecationReason}`
                        : ''}
                      )
                    </Text>
                  ) : null}
                </ListItem>
              ))}
            </List>
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
