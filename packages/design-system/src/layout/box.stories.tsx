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

    // Per-breakpoint padding — one dropdown per breakpoint, so the
    // composer can author responsive values (not just the base).
    pSm: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    pMd: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    pLg: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    pXl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    // Per-breakpoint display — one dropdown per breakpoint, so the
    // composer can author responsive values (not just the base).
    displaySm: {
      control: 'select',
      options: ['hidden', 'block', 'flex', 'inline-flex', 'grid'],
    },
    displayMd: {
      control: 'select',
      options: ['hidden', 'block', 'flex', 'inline-flex', 'grid'],
    },
    displayLg: {
      control: 'select',
      options: ['hidden', 'block', 'flex', 'inline-flex', 'grid'],
    },
    displayXl: {
      control: 'select',
      options: ['hidden', 'block', 'flex', 'inline-flex', 'grid'],
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
    // Per-container-size padding.
    pCqMd: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    pCqLg: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    pCqXl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    pCq2xl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    pCq3xl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    pCq4xl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    // Per-container-size display.
    displayCqMd: {
      control: 'select',
      options: ['hidden', 'block', 'flex', 'inline-flex', 'grid'],
    },
    displayCqLg: {
      control: 'select',
      options: ['hidden', 'block', 'flex', 'inline-flex', 'grid'],
    },
    displayCqXl: {
      control: 'select',
      options: ['hidden', 'block', 'flex', 'inline-flex', 'grid'],
    },
    displayCq2xl: {
      control: 'select',
      options: ['hidden', 'block', 'flex', 'inline-flex', 'grid'],
    },
    displayCq3xl: {
      control: 'select',
      options: ['hidden', 'block', 'flex', 'inline-flex', 'grid'],
    },
    displayCq4xl: {
      control: 'select',
      options: ['hidden', 'block', 'flex', 'inline-flex', 'grid'],
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
