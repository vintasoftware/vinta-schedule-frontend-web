/**
 * SchemaTypeDetail — a single type's detail view, shaped by its `kind`.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { GraphQLSchemaType } from '@/lib/docs/parse-schema';
import { SchemaTypeDetail } from './schema-type-detail';

const objectType: GraphQLSchemaType = {
  kind: 'OBJECT',
  name: 'BookableSlot',
  slug: 'BookableSlot',
  description: 'A single bookable time window.',
  fields: [
    {
      name: 'startTime',
      description: 'The slot start time.',
      args: [],
      type: 'DateTime!',
      typeName: 'DateTime',
      isDeprecated: false,
      deprecationReason: null,
    },
  ],
  inputFields: [],
  enumValues: [],
};

const inputType: GraphQLSchemaType = {
  kind: 'INPUT_OBJECT',
  name: 'CreateCalendarGroupEventInput',
  slug: 'CreateCalendarGroupEventInput',
  description: null,
  fields: [],
  inputFields: [
    {
      name: 'calendarGroupId',
      description: 'The target calendar group.',
      args: [],
      type: 'ID!',
      typeName: 'ID',
      isDeprecated: false,
      deprecationReason: null,
    },
  ],
  enumValues: [],
};

const enumType: GraphQLSchemaType = {
  kind: 'ENUM',
  name: 'SlotStatus',
  slug: 'SlotStatus',
  description: 'Whether a bookable slot is open or taken.',
  fields: [],
  inputFields: [],
  enumValues: [
    {
      name: 'AVAILABLE',
      description: 'The slot is open.',
      isDeprecated: false,
      deprecationReason: null,
    },
  ],
};

describe('SchemaTypeDetail', () => {
  it('renders an OBJECT type name, description, and fields', () => {
    render(
      <SchemaTypeDetail type={objectType} documentedTypeNames={new Set()} />
    );

    expect(screen.getByText('BookableSlot')).toBeInTheDocument();
    expect(
      screen.getByText('A single bookable time window.')
    ).toBeInTheDocument();
    expect(screen.getByText('startTime')).toBeInTheDocument();
  });

  it('renders an INPUT_OBJECT type input fields', () => {
    render(
      <SchemaTypeDetail type={inputType} documentedTypeNames={new Set()} />
    );

    expect(screen.getByText('Input Fields')).toBeInTheDocument();
    expect(screen.getByText('calendarGroupId')).toBeInTheDocument();
  });

  it('renders an ENUM type values', () => {
    render(
      <SchemaTypeDetail type={enumType} documentedTypeNames={new Set()} />
    );

    expect(screen.getByText('Values')).toBeInTheDocument();
    expect(screen.getByText('AVAILABLE')).toBeInTheDocument();
    expect(screen.getByText(/The slot is open\./)).toBeInTheDocument();
  });

  it('links back to the schema reference index', () => {
    render(
      <SchemaTypeDetail type={objectType} documentedTypeNames={new Set()} />
    );

    expect(
      screen.getByRole('link', { name: /Back to Schema Reference/ })
    ).toHaveAttribute('href', '/docs/reference#types');
  });
});
