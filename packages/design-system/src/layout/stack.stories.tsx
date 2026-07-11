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
