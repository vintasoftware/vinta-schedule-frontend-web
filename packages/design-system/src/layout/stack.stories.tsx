import type { Meta, StoryObj } from '../story-types';

import { Stack } from './stack';
import { Button } from '../ui/button';

const meta = {
  title: 'Layout/Stack',
  component: Stack,
  tags: ['autodocs'],
  // Container with BOTH curated scalar controls AND a slot. The typed
  // style-prop vocabulary (layout-style.ts) maps cleanly to select/radio
  // controls; `children` is the composed content slot (§3), typed ReactNode via
  // FlexProps → React.HTMLAttributes. `className`/`style` stay unexposed (§6).
  argTypes: {
    direction: { control: 'inline-radio', options: ['column', 'row'] },
    gap: { control: 'select', options: [0, 1, 2, 3, 4, 5, 6, 8] },
    align: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch', 'baseline'],
    },
    justify: {
      control: 'select',
      options: ['start', 'center', 'end', 'between', 'around', 'evenly'],
    },
    wrap: { control: 'boolean' },

    // Per-breakpoint direction — one dropdown per breakpoint, so the
    // composer can author responsive values (not just the base).
    directionSm: { control: 'select', options: ['row', 'column'] },
    directionMd: { control: 'select', options: ['row', 'column'] },
    directionLg: { control: 'select', options: ['row', 'column'] },
    directionXl: { control: 'select', options: ['row', 'column'] },
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
    // Per-container-size direction.
    directionCqMd: { control: 'select', options: ['row', 'column'] },
    directionCqLg: { control: 'select', options: ['row', 'column'] },
    directionCqXl: { control: 'select', options: ['row', 'column'] },
    directionCq2xl: { control: 'select', options: ['row', 'column'] },
    directionCq3xl: { control: 'select', options: ['row', 'column'] },
    directionCq4xl: { control: 'select', options: ['row', 'column'] },
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
  args: { direction: 'column', gap: 4 },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className='bg-vinta-50 text-vinta-700 rounded-md px-4 py-2 text-sm'>
    {children}
  </div>
);

export const Vertical: Story = {
  render: (args) => (
    <Stack {...args}>
      <Box>One</Box>
      <Box>Two</Box>
      <Box>Three</Box>
    </Stack>
  ),
};

export const Horizontal: Story = {
  args: { direction: 'row', gap: 2, align: 'center' },
  render: (args) => (
    <Stack {...args}>
      <Button>Save</Button>
      <Button variant='outline'>Cancel</Button>
    </Stack>
  ),
};
