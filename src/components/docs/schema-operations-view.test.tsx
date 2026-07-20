/**
 * SchemaOperationsView — the `/docs/reference/queries` and `/mutations` pages:
 * one card per operation with a description, arguments, and an example.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { GraphQLSchemaField } from '@/lib/docs/parse-schema';
import { SchemaOperationsView } from './schema-operations-view';

const withDescription: GraphQLSchemaField = {
  name: 'calendarGroupBookableSlots',
  description: 'Lists bookable slots for a calendar group.',
  args: [
    {
      name: 'organizationId',
      description: null,
      type: 'ID!',
      typeName: 'ID',
      defaultValue: null,
    },
  ],
  type: '[BookableSlot!]!',
  typeName: 'BookableSlot',
  isDeprecated: false,
  deprecationReason: null,
};

const withoutDescription: GraphQLSchemaField = {
  name: 'calendarGroupEvents',
  description: null,
  args: [],
  type: '[CalendarEvent!]!',
  typeName: 'CalendarEvent',
  isDeprecated: false,
  deprecationReason: null,
};

function renderView(fields: GraphQLSchemaField[]) {
  return render(
    <SchemaOperationsView
      title='Queries'
      intro='Read operations.'
      operationType='query'
      fields={fields}
      documentedTypeNames={new Set(['BookableSlot'])}
      examples={
        new Map([
          [
            'calendarGroupBookableSlots',
            '<pre><code class="hljs">query Example</code></pre>',
          ],
        ])
      }
      emptyLabel='This schema has no queries.'
    />
  );
}

describe('SchemaOperationsView', () => {
  it('renders the operation name and its arguments', () => {
    renderView([withDescription]);

    expect(screen.getByText('calendarGroupBookableSlots')).toBeInTheDocument();
    expect(screen.getByText('organizationId:')).toBeInTheDocument();
  });

  it('shows the schema description when present', () => {
    renderView([withDescription]);

    expect(
      screen.getByText('Lists bookable slots for a calendar group.')
    ).toBeInTheDocument();
  });

  it('falls back to a humanized description when none is provided', () => {
    renderView([withoutDescription]);

    expect(
      screen.getByText('Returns calendar group events.')
    ).toBeInTheDocument();
  });

  it('injects the pre-rendered example when one is supplied', () => {
    renderView([withDescription]);

    expect(screen.getByText('query Example')).toBeInTheDocument();
  });
});
