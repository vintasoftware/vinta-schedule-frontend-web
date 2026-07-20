import { describe, it, expect } from 'vitest';

import {
  buildOperationExample,
  describeOperation,
  humanizeFieldName,
} from './build-operation-example';
import type { GraphQLSchemaField, GraphQLSchemaType } from './parse-schema';

const bookableSlot: GraphQLSchemaType = {
  kind: 'OBJECT',
  name: 'BookableSlot',
  slug: 'BookableSlot',
  description: null,
  fields: [
    {
      name: 'start',
      description: null,
      args: [],
      type: 'DateTime!',
      typeName: 'DateTime',
      isDeprecated: false,
      deprecationReason: null,
    },
    {
      name: 'calendar',
      description: null,
      args: [],
      type: 'Calendar!',
      typeName: 'Calendar',
      isDeprecated: false,
      deprecationReason: null,
    },
  ],
  inputFields: [],
  enumValues: [],
};

const createEventInput: GraphQLSchemaType = {
  kind: 'INPUT_OBJECT',
  name: 'CreateCalendarGroupEventInput',
  slug: 'CreateCalendarGroupEventInput',
  description: null,
  fields: [],
  inputFields: [
    {
      name: 'groupId',
      description: null,
      args: [],
      type: 'ID!',
      typeName: 'ID',
      isDeprecated: false,
      deprecationReason: null,
    },
    {
      name: 'title',
      description: null,
      args: [],
      type: 'String',
      typeName: 'String',
      isDeprecated: false,
      deprecationReason: null,
    },
  ],
  enumValues: [],
};

const typesByName = new Map<string, GraphQLSchemaType>([
  [bookableSlot.name, bookableSlot],
  [createEventInput.name, createEventInput],
]);

const bookableSlotsQuery: GraphQLSchemaField = {
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
    {
      name: 'search',
      description: null,
      type: 'String',
      typeName: 'String',
      defaultValue: null,
    },
  ],
  type: '[BookableSlot!]!',
  typeName: 'BookableSlot',
  isDeprecated: false,
  deprecationReason: null,
};

const createEventMutation: GraphQLSchemaField = {
  name: 'createCalendarGroupEvent',
  description: null,
  args: [
    {
      name: 'input',
      description: null,
      type: 'CreateCalendarGroupEventInput!',
      typeName: 'CreateCalendarGroupEventInput',
      defaultValue: null,
    },
  ],
  type: 'BookableSlot!',
  typeName: 'BookableSlot',
  isDeprecated: false,
  deprecationReason: null,
};

describe('humanizeFieldName', () => {
  it('splits camelCase into a sentence', () => {
    expect(humanizeFieldName('calendarGroupBookableSlots')).toBe(
      'Calendar group bookable slots'
    );
  });

  it('handles a leading verb', () => {
    expect(humanizeFieldName('createCalendarGroupEvent')).toBe(
      'Create calendar group event'
    );
  });
});

describe('describeOperation', () => {
  it('uses the schema description when present', () => {
    expect(describeOperation(bookableSlotsQuery, 'query')).toBe(
      'Lists bookable slots for a calendar group.'
    );
  });

  it('falls back to a humanized query sentence', () => {
    expect(
      describeOperation({ ...bookableSlotsQuery, description: null }, 'query')
    ).toBe('Returns calendar group bookable slots.');
  });

  it('falls back to a humanized mutation sentence', () => {
    expect(describeOperation(createEventMutation, 'mutation')).toBe(
      'Create calendar group event.'
    );
  });
});

describe('buildOperationExample', () => {
  it('names the operation and includes only required args', () => {
    const example = buildOperationExample(
      bookableSlotsQuery,
      'query',
      typesByName
    );

    expect(example).toContain('query CalendarGroupBookableSlots {');
    expect(example).toContain('calendarGroupBookableSlots(');
    // required ID arg is filled with a placeholder…
    expect(example).toContain('organizationId: "<organizationId>"');
    // …and the optional String arg is omitted.
    expect(example).not.toContain('search:');
    // object return type gets a leaf selection set.
    expect(example).toContain('start');
    expect(example).not.toContain('undefined');
  });

  it('expands an input-object mutation argument one level deep', () => {
    const example = buildOperationExample(
      createEventMutation,
      'mutation',
      typesByName
    );

    expect(example).toContain('mutation CreateCalendarGroupEvent {');
    expect(example).toContain('input: { groupId: "<groupId>" }');
  });
});
