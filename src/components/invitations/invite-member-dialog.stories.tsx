import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InviteMemberDialog } from './invite-member-dialog';

// ---------------------------------------------------------------------------
// Query client wrapper — provides TanStack Query context required by the
// component's mutation hooks. Uses zero retries so network errors surface
// immediately in Storybook instead of hanging.
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
// Story wrappers — keep `open` as state so the close button works.
// ---------------------------------------------------------------------------

function DefaultStory() {
  const [open, setOpen] = React.useState(true);
  return (
    <QueryWrapper>
      <InviteMemberDialog open={open} onOpenChange={setOpen} />
    </QueryWrapper>
  );
}

function DuplicateWarningStory() {
  const [open, setOpen] = React.useState(true);
  return (
    <QueryWrapper>
      {/* _storyInitialExistingInvite seeds the duplicate-detected UI state
          without triggering a live API call. Story-use only. */}
      <InviteMemberDialog
        open={open}
        onOpenChange={setOpen}
        _storyInitialExistingInvite={{ id: 42, email: 'alice@acme.com' }}
      />
    </QueryWrapper>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/Invitations/InviteMemberDialog',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default — empty form ready to accept an email address. */
export const Default: Story = {
  render: () => <DefaultStory />,
};

/** DuplicateWarning — shows the inline notice and Resend button when an existing pending invite is detected. */
export const DuplicateWarning: Story = {
  render: () => <DuplicateWarningStory />,
};
