/**
 * SchemaTypesView — the `/docs/reference/types` table of documented types plus
 * custom scalars, each row linking to its detail page.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { GraphQLSchemaModel } from '@/lib/docs/parse-schema';
import { SchemaTypesView } from './schema-types-view';

const model: GraphQLSchemaModel = {
  queries: [],
  mutations: [],
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

describe('SchemaTypesView', () => {
  it('links each type row to its detail page', () => {
    render(<SchemaTypesView model={model} />);

    expect(
      screen.getByRole('link', { name: 'BookableSlot' })
    ).toHaveAttribute('href', '/docs/reference/types/BookableSlot');
  });

  it('links back to the reference overview', () => {
    render(<SchemaTypesView model={model} />);

    expect(
      screen.getByRole('link', { name: /Schema Reference/ })
    ).toHaveAttribute('href', '/docs/reference');
  });

  it('renders custom scalars', () => {
    render(<SchemaTypesView model={model} />);

    expect(screen.getByText('DateTime')).toBeInTheDocument();
    expect(screen.getByText(/ISO-8601 date-time/)).toBeInTheDocument();
  });
});
