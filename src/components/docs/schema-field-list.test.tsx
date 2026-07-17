/**
 * SchemaFieldList — renders GraphQL fields (queries, mutations, object
 * fields, input fields) with conditional linked/plain-text type labels, a
 * deprecated badge, argument default values, and an empty state.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { GraphQLSchemaField } from '@/lib/docs/parse-schema';
import { SchemaFieldList } from './schema-field-list';

const activeField: GraphQLSchemaField = {
  name: 'calendarGroupBookableSlots',
  description: 'Lists bookable slots for a calendar group.',
  args: [
    {
      name: 'limit',
      description: 'Max results to return.',
      type: 'Int',
      typeName: 'Int',
      defaultValue: '100',
    },
  ],
  type: '[BookableSlot!]!',
  typeName: 'BookableSlot',
  isDeprecated: false,
  deprecationReason: null,
};

const deprecatedField: GraphQLSchemaField = {
  name: 'legacyBookingLookup',
  description: 'Deprecated lookup kept for backwards compatibility.',
  args: [],
  type: 'String',
  typeName: 'String',
  isDeprecated: true,
  deprecationReason: 'Use calendarGroupBookableSlots instead.',
};

describe('SchemaFieldList', () => {
  it('renders the empty state and no fields when there are none', () => {
    render(
      <SchemaFieldList
        fields={[]}
        documentedTypeNames={new Set()}
        emptyLabel='This schema has no queries.'
      />
    );

    expect(screen.getByText('This schema has no queries.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('links the return type when it resolves to a documented type', () => {
    render(
      <SchemaFieldList
        fields={[activeField]}
        documentedTypeNames={new Set(['BookableSlot'])}
      />
    );

    const link = screen.getByRole('link', { name: '[BookableSlot!]!' });
    expect(link).toHaveAttribute('href', '/docs/reference/types/BookableSlot');
  });

  it('renders the return type as plain text when it is not a documented type', () => {
    render(
      <SchemaFieldList fields={[activeField]} documentedTypeNames={new Set()} />
    );

    expect(screen.getByText('[BookableSlot!]!')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders an argument default value', () => {
    render(
      <SchemaFieldList fields={[activeField]} documentedTypeNames={new Set()} />
    );

    expect(screen.getByText('= 100')).toBeInTheDocument();
  });

  it('does not render a default value marker when the arg has none', () => {
    const fieldWithNoDefault: GraphQLSchemaField = {
      ...activeField,
      args: [{ ...activeField.args[0], defaultValue: null }],
    };

    render(
      <SchemaFieldList
        fields={[fieldWithNoDefault]}
        documentedTypeNames={new Set()}
      />
    );

    expect(screen.queryByText(/^=/)).not.toBeInTheDocument();
  });

  it('renders the deprecated badge with its reason', () => {
    render(
      <SchemaFieldList
        fields={[deprecatedField]}
        documentedTypeNames={new Set()}
      />
    );

    expect(
      screen.getByText(/^Deprecated: Use calendarGroupBookableSlots instead\.$/)
    ).toBeInTheDocument();
  });

  it('does not render the deprecated badge for an active field', () => {
    render(
      <SchemaFieldList fields={[activeField]} documentedTypeNames={new Set()} />
    );

    expect(screen.queryByText(/Deprecated/)).not.toBeInTheDocument();
  });
});
