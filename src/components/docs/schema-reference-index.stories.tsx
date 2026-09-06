import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { GraphQLSchemaModel } from '@/lib/docs/parse-schema';
import { SchemaReferenceIndex } from './schema-reference-index';

const model: GraphQLSchemaModel = {
  queries: [
    {
      name: 'appointmentTypeBookableSlots',
      description: 'Lists bookable slots for an appointment type.',
      args: [
        {
          name: 'appointmentTypeId',
          description: 'The appointment type to check.',
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
      name: 'createAppointmentTypeEvent',
      description:
        'Creates an event across every calendar in an appointment type.',
      args: [
        {
          name: 'input',
          description: 'The event to create.',
          type: 'CreateAppointmentTypeEventInput!',
          typeName: 'CreateAppointmentTypeEventInput',
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
      name: 'CreateAppointmentTypeEventInput',
      slug: 'CreateAppointmentTypeEventInput',
      description: 'Input for creating an appointment-type event.',
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
