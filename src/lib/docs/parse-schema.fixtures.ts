/**
 * A trimmed introspection fixture for `parse-schema.test.ts`. Shaped like a
 * real (but small) slice of the live `/graphql/` schema: a `Query` field
 * (`calendarGroupBookableSlots`), a `Mutation` field
 * (`createCalendarGroupEvent`) with args, an OBJECT type with nested
 * fields/args, an INPUT_OBJECT type, an ENUM type, a custom scalar, a
 * built-in scalar, and one `__`-prefixed introspection meta-type — enough to
 * exercise every filter/normalization rule in `parseSchema`.
 */
import type { IntrospectionSchema } from './graphql-introspection-query';

const nonNull = (name: string) => ({
  kind: 'NON_NULL',
  name: null,
  ofType: { kind: 'OBJECT', name, ofType: null },
});

const listOfNonNull = (name: string, kind = 'OBJECT') => ({
  kind: 'NON_NULL',
  name: null,
  ofType: {
    kind: 'LIST',
    name: null,
    ofType: {
      kind: 'NON_NULL',
      name: null,
      ofType: { kind, name, ofType: null },
    },
  },
});

const scalarRef = (name: string) => ({ kind: 'SCALAR', name, ofType: null });

export const fixtureIntrospectionSchema: IntrospectionSchema = {
  queryType: { name: 'Query' },
  mutationType: { name: 'Mutation' },
  subscriptionType: null,
  types: [
    {
      kind: 'OBJECT',
      name: 'Query',
      description: 'The root query type.',
      fields: [
        {
          name: 'calendarGroupBookableSlots',
          description: 'Lists bookable slots for a calendar group.',
          args: [
            {
              name: 'calendarGroupId',
              description: 'The calendar group to check.',
              type: nonNull('ID'),
              defaultValue: null,
            },
          ],
          type: listOfNonNull('BookableSlot'),
          isDeprecated: false,
          deprecationReason: null,
        },
        {
          name: 'searchBookableSlots',
          description: 'Searches bookable slots with pagination.',
          args: [
            {
              name: 'limit',
              description: 'Max results to return.',
              type: scalarRef('Int'),
              defaultValue: '100',
            },
          ],
          type: listOfNonNull('BookableSlot'),
          isDeprecated: false,
          deprecationReason: null,
        },
      ],
      inputFields: null,
      interfaces: [],
      enumValues: null,
      possibleTypes: null,
    },
    {
      kind: 'OBJECT',
      name: 'Mutation',
      description: 'The root mutation type.',
      fields: [
        {
          name: 'createCalendarGroupEvent',
          description: 'Creates an event across every calendar in a group.',
          args: [
            {
              name: 'input',
              description: 'The event to create.',
              type: nonNull('CreateCalendarGroupEventInput'),
              defaultValue: null,
            },
          ],
          type: nonNull('CalendarEvent'),
          isDeprecated: false,
          deprecationReason: null,
        },
      ],
      inputFields: null,
      interfaces: [],
      enumValues: null,
      possibleTypes: null,
    },
    {
      kind: 'OBJECT',
      name: 'BookableSlot',
      description: 'A single bookable time window.',
      fields: [
        {
          name: 'startTime',
          description: 'The slot start time.',
          args: [],
          type: nonNull('DateTime'),
          isDeprecated: false,
          deprecationReason: null,
        },
        {
          name: 'status',
          description: 'The slot status.',
          args: [],
          type: nonNull('SlotStatus'),
          isDeprecated: false,
          deprecationReason: null,
        },
      ],
      inputFields: null,
      interfaces: [],
      enumValues: null,
      possibleTypes: null,
    },
    {
      kind: 'INPUT_OBJECT',
      name: 'CreateCalendarGroupEventInput',
      description: 'Input for creating a calendar-group event.',
      fields: null,
      inputFields: [
        {
          name: 'calendarGroupId',
          description: 'The target calendar group.',
          type: nonNull('ID'),
          defaultValue: null,
        },
        {
          name: 'title',
          description: 'The event title.',
          type: scalarRef('String'),
          defaultValue: null,
        },
      ],
      interfaces: null,
      enumValues: null,
      possibleTypes: null,
    },
    {
      kind: 'ENUM',
      name: 'SlotStatus',
      description: 'Whether a bookable slot is open or taken.',
      fields: null,
      inputFields: null,
      interfaces: null,
      enumValues: [
        {
          name: 'AVAILABLE',
          description: 'The slot is open.',
          isDeprecated: false,
          deprecationReason: null,
        },
        {
          name: 'BOOKED',
          description: 'The slot is taken.',
          isDeprecated: false,
          deprecationReason: null,
        },
      ],
      possibleTypes: null,
    },
    {
      kind: 'SCALAR',
      name: 'DateTime',
      description: 'An ISO-8601 date-time.',
      fields: null,
      inputFields: null,
      interfaces: null,
      enumValues: null,
      possibleTypes: null,
    },
    {
      kind: 'SCALAR',
      name: 'String',
      description: null,
      fields: null,
      inputFields: null,
      interfaces: null,
      enumValues: null,
      possibleTypes: null,
    },
    {
      kind: 'OBJECT',
      name: '__Type',
      description: 'Introspection meta-type — must never leak into the model.',
      fields: [],
      inputFields: null,
      interfaces: [],
      enumValues: null,
      possibleTypes: null,
    },
  ],
};
