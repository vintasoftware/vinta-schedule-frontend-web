import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Box } from './box';

const meta = {
  title: 'Layout/Box',
  component: Box,
  tags: ['autodocs'],
  args: {
    p: 6,
    bg: 'card',
    radius: 'lg',
    shadow: 'sm',
    border: true,
    children: 'Box — styled by props, no classes.',
  },
  argTypes: {
    p: { control: 'select', options: [0, 2, 4, 6, 8, 12] },
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
  },
} satisfies Meta<typeof Box>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

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
