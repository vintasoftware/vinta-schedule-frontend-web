import type { StoryObj } from '@storybook/react';
import { TokensTable } from './tokens-table';

const meta = {
  title: 'Components / API Tokens / TokensTable',
  component: TokensTable,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * TokensTable story.
 *
 * Note: This is a client component that requires DataTableQueryBoundary context.
 * The story is a placeholder; full integration testing happens in the page-level test.
 */
export const Default: Story = {};
