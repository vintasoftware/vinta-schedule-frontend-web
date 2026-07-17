import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { GraphqlExplorer } from './graphql-explorer';

// GraphiQL introspects `apiBaseUrl` as soon as it mounts. This Storybook
// build is published to public GitHub Pages (deploy-storybook.yml) with no
// API behind it (see .storybook/preview.tsx) — a real fetch to
// `http://localhost:8000` would fail outright and, worse, be blocked as
// mixed content (http:// loading from an https:// Pages origin), leaving
// every visitor staring at a permanently broken schema panel. Stubbing
// `fetch` here (same pattern as create-group-dialog.stories.tsx) keeps the
// introspection request from ever reaching the network while the story
// still renders the component's own UI — the credential field and
// clear-token button — around the widget exactly as it would live.
function stubFetch(): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify({ data: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

const meta = {
  title: 'Docs/GraphqlExplorer',
  component: GraphqlExplorer,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => {
      global.fetch = stubFetch as typeof global.fetch;
      return <Story />;
    },
  ],
} satisfies Meta<typeof GraphqlExplorer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    apiBaseUrl: 'http://localhost:8000',
  },
};
