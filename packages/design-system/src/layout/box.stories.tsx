import type { Meta, StoryObj } from '../story-types';

import { Box } from './box';

const meta = {
  title: 'Layout/Box',
  component: Box,
  tags: ['autodocs'],
  // Box's props are the shared BoxStyleProps vocabulary (layout-style.ts). Only
  // a meaningful subset is exposed — spacing, surface, sizing. `className` /
  // `style` are deliberately NOT editable (§6), and `children` is the composed
  // content slot (§3) so it must not appear in argTypes (SLOT_ARGTYPE_COLLISION).
  argTypes: {
    p: { control: 'select', options: [0, 2, 4, 6, 8, 12] },
    px: { control: 'select', options: [0, 2, 4, 6, 8, 12] },
    py: { control: 'select', options: [0, 2, 4, 6, 8, 12] },
    radius: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'],
    },
    shadow: {
      control: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'],
    },
    bg: {
      control: 'select',
      options: ['background', 'card', 'muted', 'accent', 'primary'],
    },
    color: {
      control: 'select',
      options: [
        'foreground',
        'muted-foreground',
        'primary',
        'primary-foreground',
        'vinta-700',
      ],
    },
    border: { control: 'boolean' },
    // Per-side borders — the `border-b` / `border-r` idiom (row rules, sidebar
    // chrome), which the all-or-nothing `border` prop cannot express.
    borderTop: { control: 'boolean' },
    borderRight: { control: 'boolean' },
    borderBottom: { control: 'boolean' },
    borderLeft: { control: 'boolean' },
    width: { control: 'select', options: [180, 320, 480, 'full'] },
    textAlign: {
      control: 'inline-radio',
      options: ['left', 'center', 'right'],
    },
  },
  args: {
    p: 6,
    bg: 'card',
    radius: 'lg',
    shadow: 'sm',
    border: true,
  },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof Box>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => <Box {...args}>Box — styled by props, no classes.</Box>,
};

export const Surfaces: Story = {
  render: () => (
    <Box display='flex' style={{ gap: '1rem', flexWrap: 'wrap' }}>
      <Box p={6} bg='card' radius='lg' shadow='sm' border width={180}>
        card · shadow sm
      </Box>
      <Box p={6} bg='muted' radius='lg' width={180}>
        muted
      </Box>
      <Box
        p={6}
        bg='primary'
        color='primary-foreground'
        radius='lg'
        width={180}
      >
        primary
      </Box>
      <Box p={6} bg='vinta-50' color='vinta-700' radius='xl' width={180}>
        vinta-50 / 700
      </Box>
    </Box>
  ),
};
