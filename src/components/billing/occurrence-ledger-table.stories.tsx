import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { MeteredOccurrence } from '@/client';
import { OccurrenceLedgerTable } from './occurrence-ledger-table';

function occurrence(
  overrides: Partial<MeteredOccurrence> = {}
): MeteredOccurrence {
  return {
    id: 1,
    organization: { id: 10, name: 'Acme Inc.' },
    event: {
      id: 100,
      title: 'Weekly sync',
      calendar: { id: 5, name: 'Team calendar' },
      owners: [
        { user_id: 1, name: 'Ada Lovelace' },
        { user_id: 2, name: 'Alan Turing' },
      ],
    },
    occurrence_start: '2026-08-03T14:00:00Z',
    billing_period_start: '2026-08-01T00:00:00Z',
    is_within_allowance: false,
    unit_price: '0.5000',
    ...overrides,
  };
}

const meta = {
  title: 'Components/Billing/OccurrenceLedgerTable',
  component: OccurrenceLedgerTable,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof OccurrenceLedgerTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A mixed page: an overage row, an included row, a deleted-event row, and a
 *  row whose calendar/owners are absent. */
export const WithOccurrences: Story = {
  args: {
    currency: 'USD',
    occurrences: [
      occurrence({ id: 3 }),
      occurrence({
        id: 2,
        organization: { id: 11, name: 'Beta LLC' },
        is_within_allowance: true,
        unit_price: '0.0000',
        event: {
          id: 101,
          title: 'One-off review',
          calendar: null,
          owners: [],
        },
      }),
      // Deleted event: the charge still stands and the price is intact.
      occurrence({ id: 1, event: null, unit_price: '0.7500' }),
    ],
  },
};

/** No plan currency available — `unit_price` renders as its raw decimal. */
export const WithoutCurrency: Story = {
  args: {
    currency: null,
    occurrences: [occurrence({ id: 1 })],
  },
};

/** An empty period — a first-class, non-error state. */
export const Empty: Story = {
  args: { currency: 'USD', occurrences: [], isFiltered: false },
};

/** Empty because of active filters — distinct copy. */
export const EmptyFiltered: Story = {
  args: { currency: 'USD', occurrences: [], isFiltered: true },
};

export const Mobile: Story = {
  args: WithOccurrences.args,
  globals: { viewport: { value: 'mobile' } },
};
