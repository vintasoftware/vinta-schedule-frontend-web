import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Grid, GridItem } from './grid';

const meta = {
  title: 'Layout/Grid',
  component: Grid,
  tags: ['autodocs'],
  argTypes: {
    columns: { control: { type: 'number', min: 1, max: 12 } },
    gap: { control: 'select', options: [0, 1, 2, 3, 4, 5, 6, 8] },
  },
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
