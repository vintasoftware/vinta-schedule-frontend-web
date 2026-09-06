import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SchemaFieldList } from './schema-field-list';

const meta = {
  title: 'Docs/SchemaFieldList',
  component: SchemaFieldList,
  tags: ['autodocs'],
} satisfies Meta<typeof SchemaFieldList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Queries: Story = {
  args: {
    documentedTypeNames: new Set(['BookableSlot']),
    fields: [
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
          {
            name: 'startDate',
            description: 'Earliest date to search from.',
            type: 'DateTime',
            typeName: 'DateTime',
            defaultValue: null,
          },
        ],
        type: '[BookableSlot!]!',
        typeName: 'BookableSlot',
        isDeprecated: false,
        deprecationReason: null,
      },
      {
        name: 'legacyBookingLookup',
        description: 'Deprecated lookup kept for backwards compatibility.',
        args: [],
        type: 'String',
        typeName: 'String',
        isDeprecated: true,
        deprecationReason: 'Use appointmentTypeBookableSlots instead.',
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    fields: [],
    documentedTypeNames: new Set(),
    emptyLabel: 'This schema has no queries.',
  },
};
