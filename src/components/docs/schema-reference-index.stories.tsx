import type { Meta, StoryObj } from '@storybook/nextjs-vite';

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
    {
      kind: 'INPUT_OBJECT',
      name: 'CreateCalendarGroupEventInput',
      slug: 'CreateCalendarGroupEventInput',
      description: 'Input for creating a calendar-group event.',
      fields: [],
      inputFields: [],
      enumValues: [],
    },
    {
      kind: 'ENUM',
      name: 'SlotStatus',
      slug: 'SlotStatus',
      description: 'Whether a bookable slot is open or taken.',
      fields: [],
      inputFields: [],
      enumValues: [],
    },
  ],
  scalars: [{ name: 'DateTime', description: 'An ISO-8601 date-time.' }],
};

const meta = {
  title: 'Docs/SchemaReferenceIndex',
  component: SchemaReferenceIndex,
  tags: ['autodocs'],
} satisfies Meta<typeof SchemaReferenceIndex>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { model },
};
