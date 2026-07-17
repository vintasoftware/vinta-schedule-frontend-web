/**
 * SchemaReferenceIndex — the `/docs/reference` index: queries, mutations,
 * and a types table.
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
      args: [
        {
          name: 'calendarGroupId',
          description: 'The calendar group to check.',
          type: 'ID!',
          typeName: 'ID',
          defaultValue: null,
        },
      ],
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
      args: [
        {
          name: 'input',
          description: 'The event to create.',
          type: 'CreateCalendarGroupEventInput!',
          typeName: 'CreateCalendarGroupEventInput',
          defaultValue: null,
        },
      ],
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
  it('renders queries with their args', () => {
    render(<SchemaReferenceIndex model={model} />);

    expect(screen.getByText('calendarGroupBookableSlots')).toBeInTheDocument();
    expect(screen.getByText('calendarGroupId:')).toBeInTheDocument();
  });

  it('renders mutations with their args', () => {
    render(<SchemaReferenceIndex model={model} />);

    expect(screen.getByText('createCalendarGroupEvent')).toBeInTheDocument();
    expect(screen.getByText('input:')).toBeInTheDocument();
  });

  it('renders the types table with a link to the type detail page', () => {
    render(<SchemaReferenceIndex model={model} />);

    const typeLink = screen.getByRole('link', { name: 'BookableSlot' });
    expect(typeLink).toHaveAttribute(
      'href',
      '/docs/reference/types/BookableSlot'
    );
  });

  it('links a query return type that resolves to a documented type', () => {
    render(<SchemaReferenceIndex model={model} />);

    const links = screen.getAllByRole('link', { name: '[BookableSlot!]!' });
    expect(links[0]).toHaveAttribute(
      'href',
      '/docs/reference/types/BookableSlot'
    );
  });

  it('renders custom scalars', () => {
    render(<SchemaReferenceIndex model={model} />);

    expect(screen.getByText('DateTime')).toBeInTheDocument();
    expect(screen.getByText(/ISO-8601 date-time/)).toBeInTheDocument();
  });
});
