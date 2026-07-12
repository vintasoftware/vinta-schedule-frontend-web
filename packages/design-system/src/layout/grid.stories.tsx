import type { Meta, StoryObj } from '../story-types';

import { Grid, GridItem } from './grid';

const meta = {
  title: 'Layout/Grid',
  component: Grid,
  tags: ['autodocs'],
  // GridProps = grid vocabulary (columns/rows/gap/align/justify/inline) + the
  // shared BoxStyleProps. `children` is the composed content slot (§3).
  argTypes: {
    columns: { control: { type: 'number', min: 1, max: 12 } },
    gap: { control: 'select', options: [0, 1, 2, 3, 4, 5, 6, 8] },
    rowGap: { control: 'select', options: [0, 1, 2, 3, 4, 5, 6, 8] },
    columnGap: { control: 'select', options: [0, 1, 2, 3, 4, 5, 6, 8] },
    align: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch'],
    },
    justify: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch'],
    },
    p: { control: 'select', options: [0, 2, 4, 6, 8] },

    // Per-breakpoint columns — one dropdown per breakpoint, so the
    // composer can author responsive values (not just the base).
    columnsSm: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    columnsMd: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    columnsLg: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    columnsXl: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    // Per-breakpoint gap — one dropdown per breakpoint, so the
    // composer can author responsive values (not just the base).
    gapSm: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapMd: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapLg: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapXl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },

    // ---- Container queries -------------------------------------------------
    // React to an ANCESTOR's width instead of the viewport. Declare a container
    // with `asContainer`, then point `container` at it and set the Cq* values.
    asContainer: {
      control: 'select',
      options: ['app', 'content', 'nav', 'topbar', 'pageheader'],
      description: 'Make THIS element a named container others can respond to',
    },
    container: {
      control: 'select',
      options: ['app', 'content', 'nav', 'topbar', 'pageheader'],
      description: 'Which ancestor container the Cq* values below respond to',
    },
    // Per-container-size columns.
    columnsCqMd: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    columnsCqLg: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    columnsCqXl: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    columnsCq2xl: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    columnsCq3xl: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    columnsCq4xl: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    // Per-container-size gap.
    gapCqMd: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapCqLg: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapCqXl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapCq2xl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapCq3xl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapCq4xl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
  },
  args: { columns: 12, gap: 6 },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

const Cell = ({ children }: { children: React.ReactNode }) => (
  <div className='bg-vinta-50 text-vinta-700 rounded-md px-3 py-4 text-center font-mono text-xs'>
    {children}
  </div>
);

export const TwelveColumns: Story = {
  args: { columns: 12, gap: 6 },
  render: (args) => (
    <Grid {...args}>
      {Array.from({ length: 12 }).map((_, i) => (
        <GridItem key={i} span={1}>
          <Cell>{i + 1}</Cell>
        </GridItem>
      ))}
    </Grid>
  ),
};

export const Spans: Story = {
  render: () => (
    <Grid gap={4}>
      <GridItem span={6}>
        <Cell>span 6</Cell>
      </GridItem>
      <GridItem span={6}>
        <Cell>span 6</Cell>
      </GridItem>
      <GridItem span={4}>
        <Cell>span 4</Cell>
      </GridItem>
      <GridItem span={4}>
        <Cell>span 4</Cell>
      </GridItem>
      <GridItem span={4}>
        <Cell>span 4</Cell>
      </GridItem>
      <GridItem span={8}>
        <Cell>span 8</Cell>
      </GridItem>
      <GridItem span={4}>
        <Cell>span 4</Cell>
      </GridItem>
    </Grid>
  ),
};

export const EqualColumns: Story = {
  name: 'Equal columns (columns=3)',
  render: () => (
    <Grid columns={3} gap={4}>
      {Array.from({ length: 6 }).map((_, i) => (
        <GridItem key={i}>
          <Cell>{i + 1}</Cell>
        </GridItem>
      ))}
    </Grid>
  ),
};
