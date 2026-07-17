import { describe, expect, it } from 'vitest';

import { fixtureIntrospectionSchema } from './parse-schema.fixtures';
import { parseSchema } from './parse-schema';

describe('parseSchema', () => {
  it('extracts the query field (calendarGroupBookableSlots) with its args', () => {
    const model = parseSchema(fixtureIntrospectionSchema);

    const query = model.queries.find(
      (q) => q.name === 'calendarGroupBookableSlots'
    );
    expect(query).toBeDefined();
    expect(query?.description).toBe(
      'Lists bookable slots for a calendar group.'
    );
    expect(query?.type).toBe('[BookableSlot!]!');
    expect(query?.typeName).toBe('BookableSlot');
    expect(query?.args).toEqual([
      expect.objectContaining({
        name: 'calendarGroupId',
        type: 'ID!',
        typeName: 'ID',
      }),
    ]);
  });

  it('extracts the mutation field (createCalendarGroupEvent) with its args', () => {
    const model = parseSchema(fixtureIntrospectionSchema);

    const mutation = model.mutations.find(
      (m) => m.name === 'createCalendarGroupEvent'
    );
    expect(mutation).toBeDefined();
    expect(mutation?.type).toBe('CalendarEvent!');
    expect(mutation?.typeName).toBe('CalendarEvent');
    expect(mutation?.args).toEqual([
      expect.objectContaining({
        name: 'input',
        type: 'CreateCalendarGroupEventInput!',
        typeName: 'CreateCalendarGroupEventInput',
      }),
    ]);
  });

  it('extracts an OBJECT type with nested fields and their types', () => {
    const model = parseSchema(fixtureIntrospectionSchema);

    const bookableSlot = model.types.find((t) => t.name === 'BookableSlot');
    expect(bookableSlot).toBeDefined();
    expect(bookableSlot?.kind).toBe('OBJECT');
    expect(bookableSlot?.fields).toEqual([
      expect.objectContaining({ name: 'startTime', type: 'DateTime!' }),
      expect.objectContaining({ name: 'status', type: 'SlotStatus!' }),
    ]);
  });

  it('extracts an INPUT_OBJECT type with its input fields', () => {
    const model = parseSchema(fixtureIntrospectionSchema);

    const input = model.types.find(
      (t) => t.name === 'CreateCalendarGroupEventInput'
    );
    expect(input).toBeDefined();
    expect(input?.kind).toBe('INPUT_OBJECT');
    expect(input?.inputFields.map((f) => f.name)).toEqual([
      'calendarGroupId',
      'title',
    ]);
  });

  it('extracts an ENUM type with its values', () => {
    const model = parseSchema(fixtureIntrospectionSchema);

    const status = model.types.find((t) => t.name === 'SlotStatus');
    expect(status).toBeDefined();
    expect(status?.kind).toBe('ENUM');
    expect(status?.enumValues.map((v) => v.name)).toEqual([
      'AVAILABLE',
      'BOOKED',
    ]);
  });

  it('surfaces custom scalars but drops built-in scalars', () => {
    const model = parseSchema(fixtureIntrospectionSchema);

    expect(model.scalars).toEqual([
      { name: 'DateTime', description: 'An ISO-8601 date-time.' },
    ]);
  });

  it('drops the Query/Mutation root types and __-prefixed introspection types from `types`', () => {
    const model = parseSchema(fixtureIntrospectionSchema);

    const names = model.types.map((t) => t.name);
    expect(names).not.toContain('Query');
    expect(names).not.toContain('Mutation');
    expect(names.some((n) => n.startsWith('__'))).toBe(false);
  });
});
