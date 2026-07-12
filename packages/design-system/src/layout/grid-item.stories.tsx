import type { Meta, StoryObj } from '../story-types';

import { GridItem } from './grid';
import { Box } from './box';

/**
 * GridItem — BINDING-ONLY story.
 *
 * `tags: ['!dev']` hides this from the Storybook sidebar: a grid cell is
 * meaningless on its own and would just be noise next to the real components
 * (its behaviour is already documented in the Grid story). The contract
 * extractor still reads it — it only looks at title / argTypes / parameters.puck
 * — so the composer can bind and span grid cells.
 */
const meta = {
  title: 'Layout/GridItem',
  component: GridItem,
  tags: ['!dev'],
  argTypes: {
    span: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      description: 'Columns to span',
    },
    rowSpan: { control: 'select', options: [1, 2, 3, 4, 5, 6] },

    // Per-breakpoint spans — the composer sets one dropdown per breakpoint.
    spanSm: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    spanMd: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    spanLg: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    spanXl: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },

    // ---- Container queries -------------------------------------------------
    container: {
      control: 'select',
      options: ['app', 'content', 'nav', 'topbar', 'pageheader'],
      description: 'Which ancestor container the Cq* values respond to',
    },
    spanCqMd: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    spanCqLg: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    spanCqXl: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    spanCq2xl: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    spanCq3xl: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    spanCq4xl: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
  },
  args: { span: 1 },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof GridItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <GridItem {...args}>
      <Box p={4} bg='muted' radius='md' />
    </GridItem>
  ),
};
