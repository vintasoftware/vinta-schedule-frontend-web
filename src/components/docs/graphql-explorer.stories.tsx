import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { GraphqlExplorer } from './graphql-explorer';

const meta = {
  title: 'Docs/GraphqlExplorer',
  component: GraphqlExplorer,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof GraphqlExplorer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    apiBaseUrl: 'http://localhost:8000',
  },
};
