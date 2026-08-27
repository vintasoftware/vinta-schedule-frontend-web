import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { publicApiDocsScopesListQueryKey } from '@/client/@tanstack/react-query.gen';
import type { SystemUserScope } from '@/client';
import { NewTokenDialog } from './new-token-dialog';

// The dialog builds its scope picker from `GET /public-api-docs/scopes/`, which
// Storybook has no backend to answer. Each story seeds (or deliberately does
// not seed) that query so the three states — catalog loaded, catalog in flight,
// catalog failed — are all reachable without a network.
const SCOPE_CATALOG: SystemUserScope[] = [
  { value: 'calendar', label: 'Calendar', provider_scoped: true },
  { value: 'calendar_event', label: 'Calendar Event', provider_scoped: true },
  { value: 'calendar_group', label: 'Calendar Group', provider_scoped: false },
  { value: 'available_time', label: 'Available Time', provider_scoped: true },
  { value: 'blocked_time', label: 'Blocked Time', provider_scoped: true },
  { value: 'user', label: 'User', provider_scoped: false },
  { value: 'organization', label: 'Organization', provider_scoped: false },
  {
    value: 'webhook_configuration',
    label: 'Webhook Configuration',
    provider_scoped: false,
  },
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

const meta = {
  title: 'Components/ApiTokens/NewTokenDialog',
  component: NewTokenDialog,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: () => {},
  },
} satisfies Meta<typeof NewTokenDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The catalog has loaded: one checkbox per scope the API offers. */
export const Default: Story = {
  decorators: [
    (Story) => {
      const queryClient = makeQueryClient();
      queryClient.setQueryData(
        publicApiDocsScopesListQueryKey(),
        SCOPE_CATALOG
      );
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
};

/**
 * The catalog request is still in flight. Seeded with a query function that
 * never settles, so the loading placeholder stays put.
 */
export const LoadingScopes: Story = {
  decorators: [
    (Story) => {
      const queryClient = makeQueryClient();
      queryClient.setQueryDefaults(publicApiDocsScopesListQueryKey(), {
        queryFn: () => new Promise(() => {}),
      });
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
};

/** The catalog request failed: the picker is replaced by an error alert. */
export const ScopesUnavailable: Story = {
  decorators: [
    (Story) => {
      const queryClient = makeQueryClient();
      queryClient.setQueryDefaults(publicApiDocsScopesListQueryKey(), {
        queryFn: () => Promise.reject(new Error('catalog unavailable')),
      });
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
};
