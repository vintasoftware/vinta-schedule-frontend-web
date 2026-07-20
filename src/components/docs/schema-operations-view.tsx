import Link from 'next/link';

import { Heading, Stack, Text } from 'vinta-schedule-design-system/layout';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import type { GraphQLSchemaField } from '@/lib/docs/parse-schema';
import type { OperationType } from '@/lib/docs/build-operation-example';
import { SchemaFieldList } from './schema-field-list';

export interface SchemaOperationsViewProps {
  title: string;
  intro: string;
  operationType: OperationType;
  fields: GraphQLSchemaField[];
  documentedTypeNames: Set<string>;
  /** fieldName → pre-highlighted example HTML. */
  examples: Map<string, string>;
  emptyLabel: string;
}

/**
 * `/docs/reference/queries` and `/docs/reference/mutations` — one card per
 * operation, each with its description, arguments, and an example request.
 * Shared by both pages; the caller supplies the copy and the operation kind.
 */
export function SchemaOperationsView({
  title,
  intro,
  operationType,
  fields,
  documentedTypeNames,
  examples,
  emptyLabel,
}: SchemaOperationsViewProps) {
  return (
    <Stack gap={8}>
      <Stack gap={2}>
        <TextLink asChild size='sm'>
          <Link href='/docs/reference'>← Schema Reference</Link>
        </TextLink>
        <Heading level={1}>{title}</Heading>
        <Text color='muted-foreground'>{intro}</Text>
      </Stack>

      <SchemaFieldList
        fields={fields}
        documentedTypeNames={documentedTypeNames}
        operationType={operationType}
        examples={examples}
        emptyLabel={emptyLabel}
      />
    </Stack>
  );
}
