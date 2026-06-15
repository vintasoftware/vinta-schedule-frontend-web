import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CreateOrganizationDialog } from './create-organization-dialog';

// ---------------------------------------------------------------------------
// Decorator — provides a QueryClient (required by useCreateOrganization)
// ---------------------------------------------------------------------------

function withQueryClient(Story: React.ComponentType) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Story />
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/Organizations/CreateOrganizationDialog',
  component: CreateOrganizationDialog,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [withQueryClient],
  args: {
    open: true,
    onOpenChange: (open: boolean) => console.log('onOpenChange', open),
    onCreated: (org: unknown) => console.log('onCreated', org),
  },
} satisfies Meta<typeof CreateOrganizationDialog>;

export default meta;
type Story = StoryObj<typeof meta>;
// FreeStory: for render() stories that supply their own args
type FreeStory = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default open state — the form is empty and ready to fill in. */
export const Default: Story = {};

/**
 * Interactive controlled dialog: toggling open/close and submitting work.
 * Note: the submit button will call the real API in your dev environment.
 * In Storybook CI the mutation will fail gracefully (no backend) and show the
 * error alert.
 */
export const Interactive: FreeStory = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    return (
      <div>
        <button
          type='button'
          onClick={() => setOpen(true)}
          className='bg-primary text-primary-foreground rounded px-3 py-1 text-sm'
        >
          Open dialog
        </button>
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { mutations: { retry: false } } })
          }
        >
          <CreateOrganizationDialog
            open={open}
            onOpenChange={setOpen}
            onCreated={(org) => {
              console.log('Created:', org);
              setOpen(false);
            }}
          />
        </QueryClientProvider>
      </div>
    );
  },
};

/** Dialog rendered with open=false — nothing should be visible. */
export const Closed: Story = {
  args: {
    open: false,
  },
};
