/**
 * SchemaReferenceIndex — the `/docs/reference` overview: counts and linked
 * section cards for queries, mutations, and types, plus custom scalars.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { GraphQLSchemaModel } from '@/lib/docs/parse-schema';
import { SchemaReferenceIndex } from './schema-reference-index';

const model: GraphQLSchemaModel = {
  queries: [
    {
      name: 'calendarGroupBookableSlots',
      description: 'Lists bookable slots for a calendar group.',
      args: [],
      type: '[BookableSlot!]!',
      typeName: 'BookableSlot',
      isDeprecated: false,
      deprecationReason: null,
    },
  ],
  mutations: [
    {
      name: 'createCalendarGroupEvent',
      description: 'Creates an event across every calendar in a group.',
      args: [],
      type: 'CalendarEvent!',
      typeName: 'CalendarEvent',
      isDeprecated: false,
      deprecationReason: null,
    },
  ],
  types: [
    {
      kind: 'OBJECT',
      name: 'BookableSlot',
      slug: 'BookableSlot',
      description: 'A single bookable time window.',
      fields: [],
      inputFields: [],
      enumValues: [],
    },
  ],
  scalars: [{ name: 'DateTime', description: 'An ISO-8601 date-time.' }],
};

describe('SchemaReferenceIndex', () => {
  it('links to the queries, mutations, and types pages', () => {
    render(<SchemaReferenceIndex model={model} />);

    expect(screen.getByRole('link', { name: /Queries/ })).toHaveAttribute(
      'href',
      '/docs/reference/queries'
    );
    expect(screen.getByRole('link', { name: /Mutations/ })).toHaveAttribute(
      'href',
      '/docs/reference/mutations'
    );
    expect(screen.getByRole('link', { name: /Types/ })).toHaveAttribute(
      'href',
      '/docs/reference/types'
    );
  });

  it('shows a per-section count', () => {
    render(<SchemaReferenceIndex model={model} />);

    expect(screen.getByText('1 queries')).toBeInTheDocument();
    expect(screen.getByText('1 mutations')).toBeInTheDocument();
    expect(screen.getByText('1 types')).toBeInTheDocument();
  });
});
