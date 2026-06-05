import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingFormDialog } from './booking-form';

// ---------------------------------------------------------------------------
// Query wrapper
// ---------------------------------------------------------------------------

function makeStoryQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function QueryWrapper({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeStoryQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Story wrappers — open state is controlled so close button works.
// ---------------------------------------------------------------------------

function DefaultStory() {
  const [open, setOpen] = React.useState(true);
  return (
    <QueryWrapper>
      <BookingFormDialog open={open} onOpenChange={setOpen} />
    </QueryWrapper>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/Bookings/BookingFormDialog',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default — the booking form ready to fill in (calendars will load from API). */
export const Default: Story = {
  render: () => <DefaultStory />,
};
