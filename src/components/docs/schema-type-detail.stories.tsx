import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SchemaTypeDetail } from './schema-type-detail';

const meta = {
  title: 'Docs/SchemaTypeDetail',
  component: SchemaTypeDetail,
  tags: ['autodocs'],
} satisfies Meta<typeof SchemaTypeDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ObjectType: Story = {
  args: {
    documentedTypeNames: new Set(['SlotStatus']),
    type: {
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
        {
          name: 'status',
          description: 'The slot status.',
          args: [],
          type: 'SlotStatus!',
          typeName: 'SlotStatus',
          isDeprecated: false,
          deprecationReason: null,
        },
      ],
      inputFields: [],
      enumValues: [],
    },
  },
};

export const InputObjectType: Story = {
  args: {
    documentedTypeNames: new Set(),
    type: {
      kind: 'INPUT_OBJECT',
      name: 'CreateCalendarGroupEventInput',
      slug: 'CreateCalendarGroupEventInput',
      description: 'Input for creating a calendar-group event.',
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
        {
          name: 'title',
          description: 'The event title.',
          args: [],
          type: 'String',
          typeName: 'String',
          isDeprecated: false,
          deprecationReason: null,
        },
      ],
      enumValues: [],
    },
  },
};

export const EnumType: Story = {
  args: {
    documentedTypeNames: new Set(),
    type: {
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
        {
          name: 'BOOKED',
          description: 'The slot is taken.',
          isDeprecated: false,
          deprecationReason: null,
        },
      ],
    },
  },
};
